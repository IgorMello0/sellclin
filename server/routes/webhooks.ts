import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { createErrorResponse, createSuccessResponse } from '../utils/response.js';
import { ensureCompanyDefaults } from '../bootstrap/defaults.js';
import { chooseSdrForCompany } from '../services/sdr-routing.js';
import {
  activateBillingAddon,
  addDays,
  getBillingCycleFromAbacateFrequency,
  getPeriodEndForCycle,
  getProductIdForAddon,
  getProductIdForPlan,
  isAddonCode,
  isBillingCycle,
  isPlanCode,
  markWebhookEventProcessed,
  TRIAL_DAYS,
  verifyAbacateWebhookSignature,
  type BillingCycle,
  type PlanCode,
} from '../services/billing.js';
import {
  findCompanyByInstance as findWhatsappCompanyByInstance,
  handleEvolutionPayload as handleWhatsappEvolutionPayload,
  handleMetaMessages as handleWhatsappMetaMessages,
  handleUazapiPayload as handleWhatsappUazapiPayload,
} from '../services/whatsapp-integration.js';

export const router = Router();

function secureStringEquals(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function planAndCycleFromProductId(productId?: string | null) {
  if (!productId) return null;

  const matches: Array<{ planCode: PlanCode; billingCycle: BillingCycle }> = [];

  for (const planCode of ['start', 'pro', 'enterprise'] as PlanCode[]) {
    for (const billingCycle of ['monthly', 'yearly'] as BillingCycle[]) {
      if (productId === getProductIdForPlan(planCode, billingCycle)) {
        matches.push({ planCode, billingCycle });
      }
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    console.warn('[Webhook/AbacatePay] Product ID reused across plans; using metadata or pending signup instead.', {
      productId,
      matches,
    });
  }

  return null;
}

function companyIdFromExternalId(externalId?: string | null) {
  const match = externalId?.match(/^sellclin-(\d+)-/);
  return match ? Number(match[1]) : null;
}

function pendingSignupIdFromExternalId(externalId?: string | null) {
  const match = externalId?.match(/^sellclin-signup-(\d+)-/);
  return match ? Number(match[1]) : null;
}

function billingAddonIdFromExternalId(externalId?: string | null) {
  const match = externalId?.match(/^sellclin-addon-(\d+)-/);
  return match ? Number(match[1]) : null;
}

function normalizeAbacateStatus(eventName: string, payloadStatus?: string | null) {
  const event = eventName.toLowerCase();
  const status = payloadStatus?.toLowerCase() || '';

  if (event.includes('cancel') || status.includes('cancel')) return 'canceled';
  if (event.includes('expired') || status.includes('expired')) return 'expired';
  if (event.includes('failed') || event.includes('refused') || status.includes('failed') || status.includes('refused')) {
    return 'payment_pending';
  }
  if (event.includes('trial_started') || status === 'trialing') return 'trialing';
  if (event.includes('completed') || event.includes('renewed') || status === 'active' || status === 'paid') {
    return 'active';
  }

  return 'payment_pending';
}

async function activatePendingSignup(params: {
  pendingSignupId: number
  normalizedStatus: string
  planCode?: PlanCode
  billingCycle?: BillingCycle
  subscriptionId?: string | null
  checkoutId?: string | null
}) {
  const pending = await prisma.pendingSignup.findUnique({
    where: { id: params.pendingSignupId },
  });

  if (!pending) {
    throw new Error('Cadastro pendente nao encontrado.');
  }

  if (pending.status === 'completed' && pending.companyId && pending.professionalId) {
    return {
      pendingSignupId: pending.id,
      companyId: pending.companyId,
      professionalId: pending.professionalId,
      alreadyCompleted: true,
    };
  }

  if (!['trialing', 'active'].includes(params.normalizedStatus)) {
    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: {
        status: params.normalizedStatus,
        abacateCheckoutId: params.checkoutId || pending.abacateCheckoutId,
      },
    });

    return {
      pendingSignupId: pending.id,
      status: params.normalizedStatus,
      activated: false,
    };
  }

  const existingProfessional = await prisma.professional.findUnique({
    where: { email: pending.email },
    include: { company: true },
  });

  if (existingProfessional) {
    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: {
        status: 'completed',
        professionalId: existingProfessional.id,
        companyId: existingProfessional.companyId,
        completedAt: new Date(),
      },
    });

    return {
      pendingSignupId: pending.id,
      companyId: existingProfessional.companyId,
      professionalId: existingProfessional.id,
      alreadyCompleted: true,
    };
  }

  const planCode = params.planCode || (isPlanCode(pending.planCode) ? pending.planCode : 'start');
  const billingCycle = params.billingCycle || (isBillingCycle(pending.billingCycle) ? pending.billingCycle : 'monthly');
  const trialEndsAt = addDays(new Date(), TRIAL_DAYS);

  return prisma.$transaction(async (tx) => {
    const company = await tx.empresa.create({
      data: {
        name: pending.companyName || `Empresa de ${pending.name}`,
        plan: planCode,
        isActive: true,
      },
    });

    const professional = await tx.professional.create({
      data: {
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
        phone: pending.phone,
        specialization: pending.specialization,
        companyId: company.id,
        companyName: pending.companyName,
        authProvider: 'local',
      },
    });

    await tx.empresa.update({
      where: { id: company.id },
      data: { ownerId: professional.id },
    });

    await ensureCompanyDefaults(tx, company.id, professional.id);

    await tx.companySubscription.update({
      where: { companyId: company.id },
      data: {
        planCode,
        billingCycle,
        status: params.normalizedStatus,
        accessSource: 'abacatepay',
        trialEndsAt,
        currentPeriodEndsAt: params.normalizedStatus === 'active' ? getPeriodEndForCycle(billingCycle) : null,
        abacateSubscriptionId: params.subscriptionId || null,
        abacateCheckoutId: params.checkoutId || pending.abacateCheckoutId,
        checkoutUrl: pending.checkoutUrl,
      },
    });

    await tx.pendingSignup.update({
      where: { id: pending.id },
      data: {
        status: 'completed',
        companyId: company.id,
        professionalId: professional.id,
        completedAt: new Date(),
        abacateCheckoutId: params.checkoutId || pending.abacateCheckoutId,
      },
    });

    return {
      pendingSignupId: pending.id,
      companyId: company.id,
      professionalId: professional.id,
      activated: true,
    };
  });
}

router.post('/abacate-pay', async (req, res) => {
  try {
    const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
    const querySecret = typeof req.query.webhookSecret === 'string' ? req.query.webhookSecret : undefined;

    if (!expectedSecret) {
      console.error('[Webhook/AbacatePay] ABACATEPAY_WEBHOOK_SECRET nao configurado.');
      return res.status(503).json(createErrorResponse('Webhook indisponivel', 503));
    }

    if (!secureStringEquals(querySecret, expectedSecret)) {
      console.warn('[Webhook/AbacatePay] Secret invalido ou ausente.', {
        hasExpectedSecret: true,
        hasQuerySecret: Boolean(querySecret),
      });
      return res.status(401).json(createErrorResponse('Webhook nao autorizado', 401));
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
    const signature = req.headers['x-webhook-signature'] || req.headers['x-abacate-signature'];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;

    if (!verifyAbacateWebhookSignature(rawBody, signatureValue)) {
      console.warn('[Webhook/AbacatePay] Assinatura invalida.', {
        hasSignature: Boolean(signatureValue),
        hasHmacKey: Boolean(
          process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY ||
          process.env.ABACATEPAY_PUBLIC_KEY ||
          process.env.ABACATEPAY_HMAC_KEY
        ),
      });
      return res.status(401).json(createErrorResponse('Assinatura invalida', 401));
    }

    const body = req.body || {};
    const eventId = body.id || body.eventId;
    const eventName = body.event || body.type || body.eventType || 'unknown';

    console.info('[Webhook/AbacatePay] Evento recebido.', {
      eventId,
      eventName,
      devMode: body.devMode,
    });

    if (!eventId) {
      return res.status(400).json(createErrorResponse('Evento sem id', 400));
    }

    const alreadyProcessed = await prisma.billingWebhookEvent.findUnique({
      where: { eventId },
    });

    if (alreadyProcessed) {
      return res.json(createSuccessResponse({ received: true, duplicate: true }));
    }

    const data = body.data || {};
    const directCheckout = !data.subscription && !data.checkout && (data.id || data.url || data.externalId || data.metadata || data.items);
    const checkout = data.checkout || (directCheckout ? data : {});
    const subscription = data.subscription || (directCheckout ? {} : data);
    const payment = data.payment || {};
    const itemProductId = checkout.items?.[0]?.id || subscription.items?.[0]?.id || data.productId || data.update?.productId;
    const metadata = checkout.metadata || subscription.metadata || body.metadata || {};
    const parsedPendingSignupId = Number(metadata.pendingSignupId);
    const pendingSignupId = Number.isFinite(parsedPendingSignupId) && parsedPendingSignupId > 0
      ? parsedPendingSignupId
      : pendingSignupIdFromExternalId(checkout.externalId || payment.externalId || subscription.externalId || body.externalId);
    const parsedBillingAddonId = Number(metadata.billingAddonId);
    const billingAddonId = Number.isFinite(parsedBillingAddonId) && parsedBillingAddonId > 0
      ? parsedBillingAddonId
      : billingAddonIdFromExternalId(checkout.externalId || payment.externalId || subscription.externalId || body.externalId);
    const parsedCompanyId = Number(metadata.companyId);
    const payloadCompanyId = Number.isFinite(parsedCompanyId) && parsedCompanyId > 0
      ? parsedCompanyId
      : companyIdFromExternalId(checkout.externalId || payment.externalId || subscription.externalId || body.externalId);
    const productMatch = planAndCycleFromProductId(itemProductId);
    const subscriptionId = subscription.id || data.subscriptionId || body.subscriptionId || null;
    const checkoutId = checkout.id || data.checkoutId || body.checkoutId || null;
    const linkedSubscription = subscriptionId
      ? await prisma.companySubscription.findUnique({
          where: { abacateSubscriptionId: subscriptionId },
        })
      : null;

    if (payloadCompanyId && linkedSubscription && payloadCompanyId !== linkedSubscription.companyId) {
      return res.status(409).json(createErrorResponse('Assinatura vinculada a outra clinica', 409));
    }

    const companyId = payloadCompanyId || linkedSubscription?.companyId || null;
    const providerBillingCycle = getBillingCycleFromAbacateFrequency(
      subscription.frequency || data.frequency
    );
    const planCode = productMatch?.planCode
      || metadata.planCode
      || linkedSubscription?.pendingPlanCode
      || linkedSubscription?.planCode;
    const billingCycle = productMatch?.billingCycle
      || metadata.billingCycle
      || providerBillingCycle
      || linkedSubscription?.pendingBillingCycle
      || linkedSubscription?.billingCycle;

    const normalizedStatus = normalizeAbacateStatus(eventName, subscription.status || checkout.status || payment.status);
    const resolvedPlanCode = isPlanCode(planCode) ? planCode : undefined;
    const resolvedBillingCycle = isBillingCycle(billingCycle) ? billingCycle : undefined;
    const isOperationalEvent = ['trialing', 'active'].includes(normalizedStatus);

    if (isOperationalEvent && !subscriptionId) {
      return res.status(400).json(createErrorResponse('Evento operacional sem assinatura recorrente', 400));
    }

    // Renewals may contain only the provider subscription ID. Initial activations
    // still require an exact product match so metadata cannot grant another plan.
    if (
      isOperationalEvent
      && !billingAddonId
      && !productMatch
      && (!linkedSubscription || Boolean(itemProductId))
    ) {
      return res.status(400).json(createErrorResponse('Produto do pagamento nao reconhecido', 400));
    }

    if (eventName.toLowerCase().includes('plan_changed')) {
      const planChangeStatus = data.status || data.update?.status || 'PENDING';
      const where = companyId
        ? { companyId }
        : subscriptionId
          ? { abacateSubscriptionId: subscriptionId }
          : null;

      if (!where) {
        return res.status(400).json(createErrorResponse('Evento de troca sem assinatura vinculada', 400));
      }

      const isApplied = String(planChangeStatus).toUpperCase() === 'APPLIED';
      const updatedSubscription = await prisma.companySubscription.update({
        where,
        data: {
          ...(isApplied && resolvedPlanCode ? { planCode: resolvedPlanCode } : {}),
          ...(isApplied && resolvedBillingCycle ? { billingCycle: resolvedBillingCycle } : {}),
          pendingPlanCode: isApplied ? null : resolvedPlanCode,
          pendingBillingCycle: isApplied ? null : resolvedBillingCycle,
          abacatePlanChangeId: data.id || data.update?.id || null,
          planChangeStatus,
        },
      });

      if (isApplied && resolvedPlanCode) {
        await prisma.empresa.update({
          where: { id: updatedSubscription.companyId },
          data: { plan: resolvedPlanCode },
        });
      }

      await markWebhookEventProcessed(eventId, eventName, body);
      return res.json(createSuccessResponse({ received: true, planChange: true }));
    }

    if (pendingSignupId) {
      const pending = await prisma.pendingSignup.findUnique({ where: { id: pendingSignupId } });
      if (!pending) {
        return res.status(404).json(createErrorResponse('Cadastro pendente nao encontrado', 404));
      }
      if (
        isOperationalEvent &&
        (pending.planCode !== resolvedPlanCode || pending.billingCycle !== resolvedBillingCycle)
      ) {
        return res.status(409).json(createErrorResponse('Produto divergente do cadastro pendente', 409));
      }

      const activation = await activatePendingSignup({
        pendingSignupId,
        normalizedStatus,
        planCode: resolvedPlanCode,
        billingCycle: resolvedBillingCycle,
        subscriptionId,
        checkoutId,
      });

      await markWebhookEventProcessed(eventId, eventName, body);
      return res.json(createSuccessResponse({ received: true, signup: activation }));
    }

    if (billingAddonId) {
      const addon = await prisma.billingAddon.findUnique({ where: { id: billingAddonId } });
      if (!addon || !isAddonCode(addon.addonCode) || !isBillingCycle(addon.billingCycle)) {
        return res.status(404).json(createErrorResponse('Adicional de cobranca nao encontrado', 404));
      }

      if (isOperationalEvent) {
        const expectedProductId = getProductIdForAddon(addon.addonCode, addon.billingCycle);
        if (!itemProductId || !expectedProductId || itemProductId !== expectedProductId) {
          return res.status(409).json(createErrorResponse('Produto divergente do adicional solicitado', 409));
        }
      }

      const addonActivation = await activateBillingAddon({
        billingAddonId,
        normalizedStatus,
        subscriptionId,
        checkoutId,
        billingCycle: addon.billingCycle,
        quantity: addon.quantity,
      });

      await markWebhookEventProcessed(eventId, eventName, body);
      return res.json(createSuccessResponse({ received: true, addon: addonActivation }));
    }

    if (!companyId) {
      return res.status(400).json(createErrorResponse('Evento sem clinica vinculada', 400));
    }

    const currentSubscription = linkedSubscription || await prisma.companySubscription.findUnique({
      where: { companyId },
    });
    if (!currentSubscription) {
      return res.status(404).json(createErrorResponse('Assinatura nao encontrada', 404));
    }

    if (isOperationalEvent) {
      const expectedPlanCode = currentSubscription.pendingPlanCode || currentSubscription.planCode;
      const expectedBillingCycle = currentSubscription.pendingBillingCycle || currentSubscription.billingCycle;
      if (resolvedPlanCode !== expectedPlanCode || resolvedBillingCycle !== expectedBillingCycle) {
        return res.status(409).json(createErrorResponse('Produto divergente da assinatura solicitada', 409));
      }
    }

    const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : undefined;
    const canceledAt = subscription.canceledAt
      ? new Date(subscription.canceledAt)
      : normalizedStatus === 'canceled'
        ? new Date()
        : undefined;

    await prisma.companySubscription.update({
      where: { companyId },
      data: {
        ...(isOperationalEvent && resolvedPlanCode ? { planCode: resolvedPlanCode } : {}),
        ...(isOperationalEvent && resolvedBillingCycle ? { billingCycle: resolvedBillingCycle } : {}),
        status: normalizedStatus,
        ...(isOperationalEvent ? { accessSource: 'abacatepay' } : {}),
        ...(trialEndsAt ? { trialEndsAt } : {}),
        currentPeriodEndsAt: normalizedStatus === 'active' ? getPeriodEndForCycle(resolvedBillingCycle || 'monthly') : undefined,
        abacateSubscriptionId: subscriptionId,
        abacateCheckoutId: checkoutId,
        canceledAt,
        ...(isOperationalEvent ? {
          pendingPlanCode: null,
          pendingBillingCycle: null,
        } : {}),
      },
    });

    if (isOperationalEvent && resolvedPlanCode) {
      await prisma.empresa.update({
        where: { id: companyId },
        data: { plan: resolvedPlanCode },
      });
    }

    console.info('[Webhook/AbacatePay] Assinatura reconciliada.', {
      eventName,
      companyId,
      subscriptionId,
      status: normalizedStatus,
      planCode: resolvedPlanCode,
      billingCycle: resolvedBillingCycle,
      renewalBySubscriptionId: Boolean(linkedSubscription && !itemProductId),
    });

    await markWebhookEventProcessed(eventId, eventName, body);

    return res.json(createSuccessResponse({ received: true }));
  } catch (error: any) {
    console.error('[Webhook/AbacatePay] Erro:', error);
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao processar webhook', 500));
  }
});

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/** Remove @s.whatsapp.net, @c.us, country-code prefix quirks and keep only digits */
function normalizePhone(raw: string): string {
  return raw.replace(/@.*$/, '').replace(/\D/g, '');
}

/** Find the company that owns a given Evolution instance name */
async function findCompanyByInstance(instance: string) {
  const trimmed = instance.trim();
  return prisma.empresa.findFirst({
    where: { 
      evolutionInstance: {
        equals: trimmed,
        mode: 'insensitive'
      },
      isActive: true 
    },
    select: { id: true, ownerId: true, name: true }
  });
}

/** Find the company that owns a given Meta phone-number ID */
async function findCompanyByMetaPhoneId(phoneNumberId: string) {
  return prisma.empresa.findFirst({
    where: { metaPhoneNumberId: phoneNumberId, isActive: true },
    select: { id: true, ownerId: true, name: true }
  });
}

/**
 * Core logic shared by Evolution and Meta webhooks.
 * 1. Looks up the lead by phone WITHIN the clinic (companyId).
 * 2. If missing → creates it as "prospect_lead" (Novo).
 * 3. Creates / reuses a Conversa (chat thread) for the phone+company.
 * 4. Stores the incoming message as a Mensagem for the future in-app chat.
 */
async function processIncomingMessage(opts: {
  companyId: number;
  ownerId: number | null;
  phone: string;
  pushName: string;
  messageText: string;
  rawPayload: any;
  origin: string; // 'WhatsApp' | 'WhatsApp Official'
}) {
  const { companyId, ownerId, phone, pushName, messageText, rawPayload, origin } = opts;

  if (!ownerId) {
    console.warn(`[Webhook] Empresa #${companyId} sem ownerId. Ignorando.`);
    return { action: 'ignored', reason: 'no_owner' };
  }

  // ── 1. Verificar se o Lead já existe DENTRO DESTA CLÍNICA ──
  let lead = await prisma.lead.findFirst({
    where: { phone, companyId }
  });

  let action: 'created' | 'existing' = 'existing';

  if (!lead) {
    // ── 2. Criar novo lead na clínica ──
    const sdrId = await chooseSdrForCompany(prisma, companyId);
    lead = await prisma.lead.create({
      data: {
        professionalId: ownerId,
        companyId,
        sdrId,
        name: pushName || 'Contato WhatsApp',
        phone,
        status: 'prospect_lead', // Novo no funil
        origin,
        notes: messageText ? `Primeira mensagem: ${messageText}` : null,
        tags: ['whatsapp-auto'],
        isScheduled: false,
        value: 0
      }
    });

    // Registrar atividade de criação
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'sistema',
        content: `Lead criado automaticamente via ${origin}. Nome: "${pushName}".`,
        createdBy: 'Sistema'
      }
    });

    action = 'created';
    console.log(`[Webhook] ✅ Lead #${lead.id} criado para ${phone} na clínica #${companyId}`);
  } else {
    // ── 3. Lead já existe — registrar nova atividade ──
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'sistema',
        content: `Novo contato recebido via ${origin}: "${messageText?.substring(0, 120) || '(mídia)'}"`,
        createdBy: 'Sistema'
      }
    });
    console.log(`[Webhook] ♻️ Lead #${lead.id} já existia para ${phone} na clínica #${companyId}`);
  }

  // ── 4. Criar/reusar Conversa (chat thread) ──
  let conversa = await prisma.conversa.findFirst({
    where: { phone, companyId }
  });

  if (!lead.sdrId && !conversa?.assignedUserId && !conversa?.assignedProfessionalId) {
    const sdrId = await chooseSdrForCompany(prisma, companyId);
    if (sdrId) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: { sdrId } });
    }
  }

  if (!conversa) {
    conversa = await prisma.conversa.create({
      data: {
        companyId,
        leadId: lead.id,
        professionalId: ownerId,
        assignedUserId: lead.sdrId || null,
        phone,
        app: 'whatsapp',
        channel: origin,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        lastInboundAt: new Date(),
        unreadCount: 0
      }
    });
  } else if (!conversa.leadId || (lead.sdrId && (conversa.assignedUserId !== lead.sdrId || conversa.assignedProfessionalId))) {
    conversa = await prisma.conversa.update({
      where: { id: conversa.id },
      data: {
        leadId: lead.id,
        ...(lead.sdrId ? { assignedUserId: lead.sdrId, assignedProfessionalId: null } : {}),
      },
    });
  }

  // ── 5. Salvar mensagem no histórico do chat ──
  await prisma.mensagem.create({
    data: {
      conversationId: conversa.id,
      sender: 'cliente',
      content: messageText || '(mídia)',
      rawJson: rawPayload,
      origin
    }
  });

  await prisma.conversa.update({
    where: { id: conversa.id },
    data: {
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
      unreadCount: { increment: 1 },
      status: 'OPEN',
      resolvedAt: null
    }
  });

  return { action, leadId: lead.id, conversaId: conversa.id };
}


// ═══════════════════════════════════════════════════════════
// 1) WEBHOOK — EVOLUTION API (MESSAGES_UPSERT)
// ═══════════════════════════════════════════════════════════
//
// URL SEGURA (com token único por clínica):
//   POST https://<domain>/api/webhooks/evolution/<webhookToken>
//
// URL LEGADA (fallback por nome de instância — menos seguro):
//   POST https://<domain>/api/webhooks/evolution
//

/** Lógica compartilhada de processamento do payload da Evolution */
async function handleEvolutionPayload(body: any, empresa: { id: number; ownerId: number | null; name: string }) {
  // ── Validar evento ──
  const event = body.event || '';
  const normalizedEvent = String(event).toLowerCase();
  const isEvolutionApiMessage = normalizedEvent.includes('messages');
  const isEvolutionGoMessage = normalizedEvent === 'message';
  if (!isEvolutionApiMessage && !isEvolutionGoMessage) {
    return { received: true, ignored: true, reason: 'not_message_event' };
  }

  const data = body.data || body;
  const goInfo = data.Info || data.info;
  const key = data.key || {};

  // Ignorar mensagens enviadas por mim (fromMe)
  if (key.fromMe === true || goInfo?.IsFromMe === true) {
    return { received: true, ignored: true, reason: 'fromMe' };
  }

  // Ignorar mensagens de grupo
  const remoteJid = key.remoteJid || goInfo?.Sender || goInfo?.Chat || '';
  if (remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
    return { received: true, ignored: true, reason: 'group' };
  }
  if (goInfo?.IsGroup === true) {
    return { received: true, ignored: true, reason: 'group' };
  }

  // ── Extrair dados ──
  const phone = normalizePhone(remoteJid);
  const pushName = data.pushName || data.senderName || goInfo?.PushName || '';
  const messageObj = data.message || data.Message || {};
  const messageText = messageObj.conversation
    || messageObj.extendedTextMessage?.text
    || messageObj.imageMessage?.caption
    || messageObj.videoMessage?.caption
    || messageObj.documentMessage?.caption
    || '';

  if (!phone) {
    return { received: true, ignored: true, reason: 'no_phone' };
  }

  // ── Processar ──
  const result = await processIncomingMessage({
    companyId: empresa.id,
    ownerId: empresa.ownerId,
    phone,
    pushName,
    messageText,
    rawPayload: body,
    origin: 'WhatsApp'
  });

  return { success: true, ...result };
}

// ── ROTA PRINCIPAL: com token exclusivo da clínica na URL ──
router.post('/evolution/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Identificar clínica pelo token único (100% seguro, sem depender de nome de instância)
    const empresa = await prisma.empresa.findUnique({
      where: { webhookToken: token },
      select: { id: true, ownerId: true, name: true, isActive: true }
    });

    if (!empresa || !empresa.isActive) {
      console.warn(`[Webhook/Evolution] Token "${token}" não encontrado ou empresa inativa.`);
      return res.json({ received: true, ignored: true, reason: 'invalid_token' });
    }

    console.log(`[Webhook/Evolution] ✅ Recebido para clínica "${empresa.name}" (ID: ${empresa.id})`);

    const result = await handleWhatsappEvolutionPayload(req.body, empresa);
    return res.json(result);

  } catch (error: any) {
    console.error('[Webhook/Evolution] Erro:', error);
    return res.status(200).json({ received: true, error: error.message });
  }
});

// ── ROTA LEGADA: sem token, usa nome da instância (compatibilidade retroativa) ──
router.post('/evolution', async (req, res) => {
  try {
    const body = req.body;

    const event = body.event || '';
    if (!event.includes('messages') && !event.includes('MESSAGES')) {
      return res.json({ received: true, ignored: true });
    }

    const instance = body.instance || body.instanceName || '';

    if (!instance) {
      return res.status(400).json(createErrorResponse('Dados insuficientes (instance)', 400));
    }

    // Identificar clínica pela instância (fallback — menos seguro)
    const empresa = await findWhatsappCompanyByInstance(instance);
    if (!empresa) {
      console.warn(`[Webhook/Evolution] Instância "${instance}" não encontrada no DB.`);
      return res.json({ received: true, ignored: true, reason: 'unknown_instance' });
    }

    console.log(`[Webhook/Evolution/Legacy] Recebido via rota legada para "${empresa.name}" (ID: ${empresa.id})`);

    const result = await handleWhatsappEvolutionPayload(body, empresa);
    return res.json(result);

  } catch (error: any) {
    console.error('[Webhook/Evolution] Erro:', error);
    return res.status(200).json({ received: true, error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════
// 2) WEBHOOK — UAZAPI
// ═══════════════════════════════════════════════════════════
router.post('/uazapi/:token', async (req, res) => {
  try {
    const empresa = await prisma.empresa.findFirst({
      where: {
        webhookToken: req.params.token,
        whatsappProvider: 'uazapi',
        isActive: true,
      },
      select: { id: true, ownerId: true, name: true },
    });

    if (!empresa) {
      return res.json({ received: true, ignored: true, reason: 'invalid_token' });
    }

    const result = await handleWhatsappUazapiPayload(req.body, empresa);
    return res.json(result);
  } catch (error: any) {
    console.error('[Webhook/UAZAPI] Erro:', error);
    // UAZAPI retries non-2xx deliveries. Acknowledge malformed events after logging.
    return res.status(200).json({ received: true, error: error.message });
  }
});

// 3) WEBHOOK — META OFFICIAL WHATSAPP BUSINESS API
// ═══════════════════════════════════════════════════════════
//
// URL SEGURA (com token):
//   GET  https://<domain>/api/webhooks/meta/<webhookToken>
//   POST https://<domain>/api/webhooks/meta/<webhookToken>
//
// URL LEGADA (sem token):
//   GET  https://<domain>/api/webhooks/meta
//   POST https://<domain>/api/webhooks/meta
//

/** Lógica compartilhada de verificação do Meta challenge */
function verifyMetaSignature(req: any) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;

  const signature = String(req.headers['x-hub-signature-256'] || '');
  if (!signature.startsWith('sha256=')) return false;

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody || '')
    .digest('hex');
  const received = signature.slice('sha256='.length);

  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function handleMetaVerification(req: any, res: any, webhookToken?: string) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  let expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'sellclin-verify';

  if (webhookToken) {
    const empresa = await prisma.empresa.findUnique({
      where: { webhookToken },
      select: { metaWebhookVerifyToken: true, isActive: true },
    });
    if (!empresa?.isActive) {
      return res.sendStatus(403);
    }
    expectedToken = empresa.metaWebhookVerifyToken || expectedToken;
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    console.log('[Webhook/Meta] Challenge verificado com sucesso.');
    return res.status(200).type('text/plain').send(challenge);
  }

  return res.sendStatus(403);
}

/** Lógica compartilhada de processamento de mensagens do Meta */
async function handleMetaMessages(body: any, empresaOverride?: { id: number; ownerId: number | null; name: string }) {
  if (!body.entry || !Array.isArray(body.entry)) {
    return;
  }

  for (const entry of body.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const value = change.value || {};
      const metadata = value.metadata || {};
      const phoneNumberId = metadata.phone_number_id || '';
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      if (messages.length === 0) continue;

      // Se já temos a empresa via token, usar ela. Senão, buscar pelo phoneNumberId
      let empresa = empresaOverride;
      if (!empresa) {
        if (!phoneNumberId) continue;
        empresa = await findCompanyByMetaPhoneId(phoneNumberId);
        if (!empresa) {
          console.warn(`[Webhook/Meta] phone_number_id "${phoneNumberId}" não encontrado no DB.`);
          continue;
        }
      }

      for (const msg of messages) {
        if (msg.type === 'status' || !msg.from) continue;

        const phone = normalizePhone(msg.from);
        const contactInfo = contacts.find((c: any) => c.wa_id === msg.from);
        const pushName = contactInfo?.profile?.name || '';
        const messageText = msg.text?.body
          || msg.image?.caption
          || msg.video?.caption
          || '';

        await processIncomingMessage({
          companyId: empresa.id,
          ownerId: empresa.ownerId,
          phone,
          pushName,
          messageText,
          rawPayload: msg,
          origin: 'WhatsApp Official'
        });
      }
    }
  }
}

// Verificação (GET) — com token
router.get('/meta/:token', (req, res) => handleMetaVerification(req, res, req.params.token));
// Verificação (GET) — legada
router.get('/meta', (req, res) => handleMetaVerification(req, res));

// Receber mensagens (POST) — com token
router.post('/meta/:token', async (req, res) => {
  try {
    if (!verifyMetaSignature(req)) {
      console.warn('[Webhook/Meta] Assinatura invalida.');
      return res.sendStatus(403);
    }

    const { token } = req.params;
    const empresa = await prisma.empresa.findUnique({
      where: { webhookToken: token },
      select: { id: true, ownerId: true, name: true, isActive: true }
    });

    if (!empresa || !empresa.isActive) {
      console.warn(`[Webhook/Meta] Token "${token}" não encontrado ou empresa inativa.`);
      return res.sendStatus(200);
    }

    console.log(`[Webhook/Meta] ✅ Recebido para clínica "${empresa.name}" (ID: ${empresa.id})`);
    const result = await handleWhatsappMetaMessages(req.body, empresa);
    console.log('[Webhook/Meta] Processamento concluido:', result);
    return res.sendStatus(200);
  } catch (error: any) {
    console.error('[Webhook/Meta] Erro:', error);
    return res.sendStatus(500);
  }
});

// Receber mensagens (POST) — legada (busca por phone_number_id)
router.post('/meta', async (req, res) => {
  try {
    if (!verifyMetaSignature(req)) {
      console.warn('[Webhook/Meta] Assinatura invalida.');
      return res.sendStatus(403);
    }

    const result = await handleWhatsappMetaMessages(req.body);
    console.log('[Webhook/Meta] Processamento legado concluido:', result);
    return res.sendStatus(200);
  } catch (error: any) {
    console.error('[Webhook/Meta] Erro:', error);
    return res.sendStatus(500);
  }
});


// ═══════════════════════════════════════════════════════════
// 3) WEBHOOK UNIVERSAL DE LEADS (já existente — Meta Ads, Zapier, etc.)
// ═══════════════════════════════════════════════════════════
router.post('/leads/:apiKey', async (req, res) => {
  try {
    const { apiKey } = req.params;
    const data = req.body;

    if (!apiKey) {
      return res.status(401).json(createErrorResponse('API Key ausente', 401));
    }

    // 1. Identificar a Empresa dona do Webhook
    const empresa = await prisma.empresa.findFirst({
      where: { apiKey, isActive: true },
    });

    if (!empresa) {
      return res.status(401).json(createErrorResponse('API Key inválida ou empresa inativa', 401));
    }

    // 2. Encontrar o Profissional Admin / Padrão da Empresa para atribuir o Lead
    const professional = await prisma.professional.findFirst({
      where: { companyId: empresa.id }
    });

    if (!professional) {
      return res.status(400).json(createErrorResponse('Nenhum profissional configurado para receber leads nesta empresa.', 400));
    }

    // 3. Normalização de Dados do Payload (Mapeamento flexível)
    const name = data.name || data.nome || data.full_name || 'Lead sem nome';
    const email = data.email || data.mail || null;
    const phone = data.phone || data.telefone || data.whatsapp || data.celular || null;
    const value = parseFloat(data.value || data.valor || 0);
    
    // Tratamento de UTM e Origem
    let origin = data.origin || data.origem || 'API Webhook';
    if (data.utm_source) {
      origin = String(data.utm_source);
    } else if (data.form_name?.toLowerCase().includes('facebook') || data.source === 'fb_ig') {
      origin = 'Facebook Ads';
    }

    const observations = JSON.stringify(data, null, 2);

    // 4. Verificar se já existe um Lead com este telefone NESTA EMPRESA
    const existingLead = await prisma.lead.findFirst({
      where: { 
        phone: phone ? String(phone) : undefined,
        companyId: empresa.id
      }
    });
    
    if (existingLead) {
      console.log(`[Webhooks] Lead duplicado detectado (#${existingLead.id}). Atualizando...`);
      
      const updatedLead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          notes: existingLead.notes ? `${existingLead.notes}\n\n[Novo Contato]: ${observations}` : observations,
          activities: {
            create: {
              type: 'sistema',
              content: `Novo contato recebido via webhook (${origin}). Dados atualizados.`,
              createdBy: 'Sistema'
            }
          }
        }
      });
      
      return res.json(createSuccessResponse({ 
        message: 'Lead já existente atualizado com sucesso!',
        leadId: updatedLead.id,
        isDuplicate: true
      }));
    }
    
    // 5. Criação do Lead
    const newLead = await prisma.lead.create({
      data: {
        professionalId: professional.id,
        companyId: empresa.id,
        name,
        email,
        phone,
        value,
        origin,
        status: 'prospect_lead',
        notes: observations,
        isScheduled: false
      }
    });

    res.status(201).json(createSuccessResponse({ 
      message: 'Lead recebido com sucesso!',
      leadId: newLead.id 
    }));

  } catch (error: any) {
    console.error('[Webhooks] Erro ao processar lead:', error);
    res.status(500).json(createErrorResponse('Erro interno no processamento do Webhook', 500));
  }
});
