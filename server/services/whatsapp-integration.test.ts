import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMetaConnectUrl, verifyMetaState } from './meta-whatsapp.js'
import { handleMetaMessages, handleUazapiPayload, processIncomingMessage } from './whatsapp-integration.js'
import { chooseSdrForCompany } from './sdr-routing.js'

type RecordData = Record<string, any>

function createFakeDatabase(options: { failFirstMessageCreate?: boolean; routingMode?: string; sdrs?: Array<{ id: number; leadRoutingWeight: number }> } = {}) {
  const state = {
    leads: [] as RecordData[],
    conversations: [] as RecordData[],
    messages: [] as RecordData[],
    activities: [] as RecordData[],
    webhookEvents: [] as RecordData[],
  }

  let nextLeadId = 1
  let nextConversationId = 1
  let nextMessageId = 1
  let nextActivityId = 1
  let shouldFailMessageCreate = options.failFirstMessageCreate === true

  const db = {
    empresa: {
      findUnique: async () => ({ leadRoutingMode: options.routingMode || 'manual' }),
      findFirst: async () => null,
    },
    usuario: { findMany: async () => options.sdrs || [] },
    lead: {
      findFirst: async ({ where }: any) => state.leads.find(
        (lead) => lead.phone === where.phone && lead.companyId === where.companyId,
      ) || null,
      create: async ({ data }: any) => {
        const lead = { id: nextLeadId++, ...data }
        state.leads.push(lead)
        return lead
      },
      update: async ({ where, data }: any) => {
        const lead = state.leads.find((item) => item.id === where.id)
        if (!lead) throw new Error('Lead not found')
        Object.assign(lead, data)
        return lead
      },
    },
    conversa: {
      findFirst: async ({ where }: any) => state.conversations.find(
        (conversation) => conversation.phone === where.phone && conversation.companyId === where.companyId,
      ) || null,
      create: async ({ data }: any) => {
        const conversation = { id: nextConversationId++, ...data }
        state.conversations.push(conversation)
        return conversation
      },
      update: async ({ where, data }: any) => {
        const conversation = state.conversations.find((item) => item.id === where.id)
        if (!conversation) throw new Error('Conversation not found')
        Object.assign(conversation, data)
        return conversation
      },
    },
    mensagem: {
      findFirst: async ({ where }: any) => state.messages.find(
        (message) => message.conversationId === where.conversationId
          && message.providerMessageId === where.providerMessageId,
      ) || null,
      create: async ({ data }: any) => {
        if (shouldFailMessageCreate) {
          shouldFailMessageCreate = false
          throw new Error('Temporary database failure')
        }
        const message = { id: nextMessageId++, ...data }
        state.messages.push(message)
        return message
      },
    },
    leadActivity: {
      create: async ({ data }: any) => {
        const activity = { id: nextActivityId++, ...data }
        state.activities.push(activity)
        return activity
      },
    },
    whatsAppWebhookEvent: {
      findUnique: async ({ where }: any) => state.webhookEvents.find(
        (event) => event.eventKey === where.eventKey,
      ) || null,
      create: async ({ data }: any) => {
        if (state.webhookEvents.some((event) => event.eventKey === data.eventKey)) {
          throw Object.assign(new Error('Duplicate webhook event'), { code: 'P2002' })
        }
        state.webhookEvents.push({ ...data })
        return data
      },
      update: async ({ where, data }: any) => {
        const event = state.webhookEvents.find((item) => item.eventKey === where.eventKey)
        if (!event) throw new Error('Webhook event not found')
        const nextData = { ...data }
        if (typeof data.attempts === 'object' && data.attempts?.increment) {
          nextData.attempts = Number(event.attempts || 0) + Number(data.attempts.increment)
        }
        Object.assign(event, nextData)
        return event
      },
    },
  }

  return { db: db as any, state }
}

function metaInboundPayload(messageId: string, text: string) {
  return {
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: 'meta-phone-1' },
          contacts: [{ wa_id: '5511999990001', profile: { name: 'Lead Meta' } }],
          messages: [{
            id: messageId,
            from: '5511999990001',
            timestamp: '1784246400',
            type: 'text',
            text: { body: text },
          }],
        },
      }],
    }],
  }
}

function metaInboundPayloadWithAvatar(messageId: string, text: string) {
  return {
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: 'meta-phone-1' },
          contacts: [{
            wa_id: '5511999990001',
            profile: { name: 'Lead Meta', picture: 'https://cdn.test/avatar.jpg' },
          }],
          messages: [{
            id: messageId,
            from: '5511999990001',
            timestamp: '1784246400',
            type: 'text',
            text: { body: text },
          }],
        },
      }],
    }],
  }
}

function metaInboundImagePayload(messageId: string) {
  return {
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: 'meta-phone-1' },
          contacts: [{ wa_id: '5511999990001', profile: { name: 'Lead Meta' } }],
          messages: [{
            id: messageId,
            from: '5511999990001',
            timestamp: '1784246400',
            type: 'image',
            image: { id: 'meta-media-1', mime_type: 'image/jpeg', caption: 'Foto recebida' },
          }],
        },
      }],
    }],
  }
}

function metaStickerPayload(messageId: string) {
  return {
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: 'meta-phone-1' },
          contacts: [{ wa_id: '5511999990001', profile: { name: 'Lead Meta' } }],
          messages: [{
            id: messageId,
            from: '5511999990001',
            timestamp: '1784246400',
            type: 'sticker',
            sticker: { id: 'meta-sticker-1', mime_type: 'image/webp', animated: false },
          }],
        },
      }],
    }],
  }
}

function metaMessageEchoPayload(messageId: string) {
  return {
    entry: [{
      changes: [{
        field: 'smb_message_echoes',
        value: {
          metadata: { phone_number_id: 'meta-phone-1' },
          contacts: [{ wa_id: '5511999990001', profile: { name: 'Lead Meta' } }],
          message_echoes: [{
            id: messageId,
            to: '5511999990001',
            timestamp: '1784246400',
            type: 'text',
            text: { body: 'Mensagem enviada pelo celular' },
          }],
        },
      }],
    }],
  }
}

function metaMessageEchoRecipientPayload(messageId: string) {
  return {
    entry: [{
      changes: [{
        field: 'smb_message_echoes',
        value: {
          metadata: { phone_number_id: 'meta-phone-1' },
          message_echoes: [{
            id: messageId,
            recipient_id: '5511999990001',
            timestamp: '1784246400',
            type: 'text',
            text: { body: 'Mensagem enviada pelo celular via recipient_id' },
          }],
        },
      }],
    }],
  }
}

test('WhatsApp Oficial cria lead, conversa e mensagem sem duplicar retry', async () => {
  process.env.META_APP_ID = 'meta-app-test'
  process.env.META_APP_SECRET = 'meta-secret-test'
  process.env.META_WHATSAPP_CONFIG_ID = 'cloud-config-id'
  process.env.META_WHATSAPP_REDIRECT_URI = 'https://sellclin.test/api/whatsapp/meta/callback'
  process.env.JWT_SECRET = 'jwt-secret-for-whatsapp-tests'

  const connectUrl = new URL(buildMetaConnectUrl(5, 10, 'cloud_api'))
  assert.equal(connectUrl.searchParams.get('config_id'), 'cloud-config-id')
  const stateToken = connectUrl.searchParams.get('state')
  assert.ok(stateToken)
  assert.equal(verifyMetaState(stateToken).officialMode, 'cloud_api')

  const { db, state } = createFakeDatabase()
  const company = { id: 5, ownerId: 10, name: 'Clinica Oficial' }
  const payload = metaInboundPayload('wamid.official-1', 'Quero agendar uma avaliacao')

  await handleMetaMessages(payload, company, db)
  await handleMetaMessages(payload, company, db)

  assert.equal(state.leads.length, 1)
  assert.equal(state.leads[0].status, 'prospect_lead')
  assert.equal(state.leads[0].origin, 'WhatsApp Official')
  assert.deepEqual(state.leads[0].tags, ['whatsapp-auto'])
  assert.equal(state.conversations.length, 1)
  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].providerMessageId, 'wamid.official-1')
  assert.equal(state.activities.length, 1)
})

test('novo lead do WhatsApp recebe SDR e a conversa acompanha o mesmo responsavel', async () => {
  const { db, state } = createFakeDatabase({ routingMode: 'automatic_equal', sdrs: [{ id: 42, leadRoutingWeight: 1 }] })
  const input = { companyId: 5, ownerId: 10, phone: '5511999000000', pushName: 'Mateus', messageText: 'Oi', rawPayload: {}, origin: 'WhatsApp' }
  await processIncomingMessage(input, db)
  assert.equal(state.leads[0].sdrId, 42)
  assert.equal(state.conversations[0].assignedUserId, 42)
  await processIncomingMessage({ ...input, messageText: 'Outra mensagem' }, db)
  assert.equal(state.leads.length, 1)
  assert.equal(state.conversations.length, 1)
  assert.equal(state.conversations[0].assignedUserId, 42)
})

test('roleta igual distribui entre os SDRs configurados', async () => {
  const { db } = createFakeDatabase({ routingMode: 'automatic_equal', sdrs: [
    { id: 11, leadRoutingWeight: 1 }, { id: 12, leadRoutingWeight: 1 }, { id: 13, leadRoutingWeight: 1 },
  ] })
  const originalRandom = Math.random
  try {
    Math.random = () => 0
    assert.equal(await chooseSdrForCompany(db, 5), 11)
    Math.random = () => 0.5
    assert.equal(await chooseSdrForCompany(db, 5), 12)
    Math.random = () => 0.99
    assert.equal(await chooseSdrForCompany(db, 5), 13)
  } finally {
    Math.random = originalRandom
  }
})

test('lead existente mantem seu SDR e atualiza conversa antiga para ele', async () => {
  const { db, state } = createFakeDatabase({ routingMode: 'automatic_equal', sdrs: [{ id: 99, leadRoutingWeight: 1 }] })
  state.leads.push({ id: 7, companyId: 5, phone: '5511888000000', sdrId: 17 })
  state.conversations.push({ id: 8, companyId: 5, phone: '5511888000000', leadId: 7, assignedUserId: null })
  await processIncomingMessage({ companyId: 5, ownerId: 10, phone: '5511888000000', pushName: 'Existente', messageText: 'Oi', rawPayload: {}, origin: 'WhatsApp' }, db)
  assert.equal(state.leads[0].sdrId, 17)
  assert.equal(state.conversations[0].assignedUserId, 17)
})

test('contato antigo sem responsavel recebe SDR quando envia nova mensagem', async () => {
  const { db, state } = createFakeDatabase({ routingMode: 'automatic_equal', sdrs: [{ id: 44, leadRoutingWeight: 1 }] })
  state.leads.push({ id: 7, companyId: 5, phone: '5511888000000', sdrId: null })
  state.conversations.push({ id: 8, companyId: 5, phone: '5511888000000', leadId: 7, assignedUserId: null, assignedProfessionalId: null })
  await processIncomingMessage({ companyId: 5, ownerId: 10, phone: '5511888000000', pushName: 'Existente', messageText: 'Oi', rawPayload: {}, origin: 'WhatsApp' }, db)
  assert.equal(state.leads[0].sdrId, 44)
  assert.equal(state.conversations[0].assignedUserId, 44)
})

test('mensagem nova preserva responsavel manual quando o lead antigo nao tem SDR', async () => {
  const { db, state } = createFakeDatabase({ routingMode: 'automatic_equal', sdrs: [{ id: 99, leadRoutingWeight: 1 }] })
  state.leads.push({ id: 7, companyId: 5, phone: '5511888000000', sdrId: null })
  state.conversations.push({ id: 8, companyId: 5, phone: '5511888000000', leadId: 7, assignedUserId: 17 })
  await processIncomingMessage({ companyId: 5, ownerId: 10, phone: '5511888000000', pushName: 'Existente', messageText: 'Oi', rawPayload: {}, origin: 'WhatsApp' }, db)
  assert.equal(state.leads[0].sdrId, null)
  assert.equal(state.conversations[0].assignedUserId, 17)
})

test('Coexistencia usa configuracao dedicada e recebe pelo pipeline oficial', async () => {
  process.env.META_APP_ID = 'meta-app-test'
  process.env.META_APP_SECRET = 'meta-secret-test'
  process.env.META_WHATSAPP_CONFIG_ID = 'cloud-config-id'
  process.env.META_WHATSAPP_COEXISTENCE_CONFIG_ID = 'coexistence-config-id'
  process.env.META_WHATSAPP_REDIRECT_URI = 'https://sellclin.test/api/whatsapp/meta/callback'
  process.env.JWT_SECRET = 'jwt-secret-for-whatsapp-tests'

  const connectUrl = new URL(buildMetaConnectUrl(8, 21, 'coexistence'))
  assert.equal(connectUrl.searchParams.get('config_id'), 'coexistence-config-id')
  assert.equal(connectUrl.searchParams.get('override_default_response_type'), 'true')
  assert.deepEqual(JSON.parse(connectUrl.searchParams.get('extras') || '{}'), {
    setup: {},
    featureType: 'whatsapp_business_app_onboarding',
    sessionInfoVersion: '3',
    version: 'v3',
  })

  const stateToken = connectUrl.searchParams.get('state')
  assert.ok(stateToken)
  assert.deepEqual(verifyMetaState(stateToken), {
    companyId: 8,
    userId: 21,
    officialMode: 'coexistence',
  })

  const { db, state } = createFakeDatabase()
  await handleMetaMessages(
    metaInboundPayload('wamid.coexistence-1', 'Mensagem pelo numero coexistente'),
    { id: 8, ownerId: 21, name: 'Clinica Coexistencia' },
    db,
  )

  assert.equal(state.leads.length, 1)
  assert.equal(state.leads[0].companyId, 8)
  assert.equal(state.messages[0].content, 'Mensagem pelo numero coexistente')
})

test('WhatsApp Oficial baixa e vincula a midia recebida a mensagem', async () => {
  const { db, state } = createFakeDatabase()
  const requestedMedia: RecordData[] = []

  await handleMetaMessages(
    metaInboundImagePayload('wamid.official-image-1'),
    { id: 5, ownerId: 10, name: 'Clinica Oficial' },
    db,
    {
      resolveMedia: async (input) => {
        requestedMedia.push(input)
        return {
          mediaUrl: 'https://sellclin.test/uploads/media/5/image.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          size: 1024,
        }
      },
    },
  )

  assert.deepEqual(requestedMedia, [{
    companyId: 5,
    mediaId: 'meta-media-1',
    mediaType: 'image',
    declaredMimeType: 'image/jpeg',
    providerMediaType: 'image',
  }])
  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].content, 'Foto recebida')
  assert.equal(state.messages[0].rawJson.mediaUrl, 'https://sellclin.test/uploads/media/5/image.jpg')
  assert.equal(state.messages[0].rawJson.mediaType, 'image')
})

test('WhatsApp Oficial salva figurinha como imagem sem perder o tipo original', async () => {
  const { db, state } = createFakeDatabase()

  await handleMetaMessages(
    metaStickerPayload('wamid.official-sticker-1'),
    { id: 5, ownerId: 10, name: 'Clinica Oficial' },
    db,
    {
      resolveMedia: async () => ({
        mediaUrl: 'https://sellclin.test/uploads/media/5/sticker.webp',
        mediaType: 'image',
        mimeType: 'image/webp',
        size: 512,
      }),
    },
  )

  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].rawJson.providerMediaType, 'sticker')
  assert.equal(state.messages[0].rawJson.isSticker, true)
})

test('Coexistencia salva mensagem enviada pelo celular apenas uma vez', async () => {
  const { db, state } = createFakeDatabase()
  const payload = metaMessageEchoPayload('wamid.coexistence-echo-1')
  const company = { id: 8, ownerId: 21, name: 'Clinica Coexistencia' }

  await handleMetaMessages(payload, company, db)
  await handleMetaMessages(payload, company, db)

  assert.equal(state.leads.length, 1)
  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].sender, 'profissional')
  assert.equal(state.messages[0].content, 'Mensagem enviada pelo celular')
  assert.equal(state.messages[0].deliveryStatus, 'sent')
  assert.ok(state.messages[0].sentAt instanceof Date)
  assert.equal(state.activities.length, 0)
})

test('Coexistencia salva mensagem enviada pelo celular com recipient_id', async () => {
  const { db, state } = createFakeDatabase()
  const payload = metaMessageEchoRecipientPayload('wamid.coexistence-echo-recipient-1')
  const company = { id: 8, ownerId: 21, name: 'Clinica Coexistencia' }

  await handleMetaMessages(payload, company, db)

  assert.equal(state.leads.length, 1)
  assert.equal(state.leads[0].phone, '5511999990001')
  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].sender, 'profissional')
  assert.equal(state.messages[0].content, 'Mensagem enviada pelo celular via recipient_id')
  assert.equal(state.messages[0].deliveryStatus, 'sent')
})

test('WhatsApp Oficial salva avatar quando o payload do contato traz foto', async () => {
  const { db, state } = createFakeDatabase()

  await handleMetaMessages(
    metaInboundPayloadWithAvatar('wamid.official-avatar-1', 'Oi'),
    { id: 5, ownerId: 10, name: 'Clinica Oficial' },
    db,
  )

  assert.equal(state.leads.length, 1)
  assert.equal(state.leads[0].avatar, 'https://cdn.test/avatar.jpg')
})

test('Coexistencia tenta novamente um webhook que falhou antes de salvar a mensagem', async () => {
  const { db, state } = createFakeDatabase({ failFirstMessageCreate: true })
  const payload = metaInboundPayload('wamid.coexistence-retry', 'Mensagem precisa chegar')
  const company = { id: 8, ownerId: 21, name: 'Clinica Coexistencia' }

  await assert.rejects(() => handleMetaMessages(payload, company, db), /Temporary database failure/)
  assert.equal(state.webhookEvents[0].status, 'failed')

  await handleMetaMessages(payload, company, db)

  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].content, 'Mensagem precisa chegar')
  assert.equal(state.webhookEvents[0].status, 'processed')
  assert.equal(state.webhookEvents[0].attempts, 2)
})

test('Coexistencia habilitada libera conexao sem allowlist de teste', async () => {
  const { isCoexistenceAllowed } = await import('./whatsapp-connections.js')

  process.env.WHATSAPP_COEXISTENCE_ENABLED = 'true'
  delete process.env.WHATSAPP_COEXISTENCE_RESTRICT_EMAILS
  delete process.env.WHATSAPP_COEXISTENCE_TEST_EMAILS

  assert.equal(isCoexistenceAllowed('cliente@sellclin.test'), true)

  process.env.WHATSAPP_COEXISTENCE_RESTRICT_EMAILS = 'true'
  process.env.WHATSAPP_COEXISTENCE_TEST_EMAILS = 'igormello403@gmail.com'

  assert.equal(isCoexistenceAllowed('cliente@sellclin.test'), false)
  assert.equal(isCoexistenceAllowed('igormello403@gmail.com'), true)
})

test('WhatsApp Nao Oficial cria lead e ignora mensagem repetida', async () => {
  const { db, state } = createFakeDatabase()
  const payload = {
    event: 'message',
    message: {
      id: 'unofficial-message-1',
      chatid: '5511988880002@s.whatsapp.net',
      senderName: 'Lead Nao Oficial',
      text: 'Gostaria de saber os valores',
      fromMe: false,
      isGroup: false,
    },
  }
  const company = { id: 9, ownerId: 30, name: 'Clinica Nao Oficial' }

  const firstResult = await handleUazapiPayload(payload, company, db)
  const retryResult = await handleUazapiPayload(payload, company, db)

  assert.ok('action' in firstResult)
  assert.ok('action' in retryResult)
  assert.equal(firstResult.action, 'created')
  assert.equal(retryResult.action, 'duplicate_message')
  assert.equal(state.leads.length, 1)
  assert.equal(state.leads[0].phone, '5511988880002')
  assert.equal(state.leads[0].status, 'prospect_lead')
  assert.equal(state.conversations.length, 1)
  assert.equal(state.messages.length, 1)
  assert.equal(state.activities.length, 1)
})

test('WhatsApp Nao Oficial salva mensagem enviada pelo celular e ignora eco da API', async () => {
  const { db, state } = createFakeDatabase()
  const company = { id: 9, ownerId: 30, name: 'Clinica Nao Oficial' }
  const sentFromPhone = {
    event: 'message',
    message: {
      id: 'unofficial-phone-message-1',
      chatid: '5511988880002@s.whatsapp.net',
      senderName: 'Lead Nao Oficial',
      text: 'Mensagem enviada no aparelho',
      fromMe: true,
      isGroup: false,
    },
  }
  const sentByApi = {
    ...sentFromPhone,
    message: { ...sentFromPhone.message, id: 'unofficial-api-message-1', wasSentByApi: true },
  }

  await handleUazapiPayload(sentFromPhone, company, db)
  const apiResult = await handleUazapiPayload(sentByApi, company, db)

  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].sender, 'profissional')
  assert.equal(apiResult.reason, 'sent_by_api')
})
