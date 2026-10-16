import { prisma } from '../prisma.js'

// Notifications persist across restarts; an advisory lock prevents duplicate
// incidents while two Swarm tasks overlap during a deployment.
export async function notifyFailure(companyId: number, key: string, title: string, content: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${companyId}, 724019)`
    const type = `failure:${key}`
    if (await tx.notification.findFirst({ where: { companyId, type } })) return
    const company = await tx.empresa.findUnique({ where: { id: companyId }, select: { ownerId: true } })
    const admins = await tx.userCompanyAccess.findMany({
      where: { companyId, isActive: true, role: { isAdmin: true }, user: { isActive: true } },
      select: { userId: true },
    })
    const legacyAdmins = await tx.usuario.findMany({
      where: { companyId, isActive: true, role: { isAdmin: true } }, select: { id: true },
    })
    const users = new Set([...admins.map(a => a.userId), ...legacyAdmins.map(a => a.id)])
    const recipients = [
      ...(company?.ownerId ? [{ recipientId: company.ownerId }] : []),
      ...Array.from(users, recipientUserId => ({ recipientUserId })),
    ]
    if (recipients.length) await tx.notification.createMany({
      data: recipients.map(recipient => ({ companyId, type, title, content, ...recipient })),
    })
  })
}

export async function scanFailureAlerts(now = new Date()) {
  const since = new Date(now.getTime() - 24 * 60 * 60_000)
  const campaigns = await prisma.messageCampaign.findMany({
    where: { updatedAt: { gte: since }, OR: [{ status: 'failed' }, { failedCount: { gt: 0 } }] },
    select: { id: true, companyId: true, name: true, status: true, failedCount: true, totalRecipients: true },
    take: 100, orderBy: { updatedAt: 'desc' },
  })
  for (const campaign of campaigns) {
    await notifyFailure(campaign.companyId, `campaign:${campaign.id}`, 'Falha na campanha',
      `A campanha “${campaign.name}” ${campaign.status === 'failed' ? 'falhou' : 'tem falhas de envio'}. ${campaign.failedCount} de ${campaign.totalRecipients} destinatários falharam. Abra Campanhas para consultar os motivos e os destinatários afetados.`)
  }
  const connections = await prisma.whatsAppConnection.findMany({
    where: { updatedAt: { gte: since }, status: { in: ['error', 'failed', 'expired'] } },
    select: { id: true, companyId: true, updatedAt: true }, take: 100,
  })
  for (const connection of connections) {
    // One alert per day while the same connection remains unhealthy.
    await notifyFailure(connection.companyId, `integration:${connection.id}:${now.toISOString().slice(0, 10)}`,
      'WhatsApp precisa de atenção', 'A integração do WhatsApp apresentou uma falha. Abra Integrações para verificar a conexão e as credenciais.')
  }
  const events = await prisma.whatsAppWebhookEvent.findMany({
    where: { status: 'failed', createdAt: { gte: since }, companyId: { not: null } },
    select: { companyId: true }, distinct: ['companyId'], take: 100,
  })
  for (const event of events) {
    await notifyFailure(event.companyId!, `integration:webhook:${now.toISOString().slice(0, 10)}`,
      'Falha ao processar eventos do WhatsApp', 'Um ou mais eventos do WhatsApp não puderam ser processados. Verifique a integração; mensagens ou atualizações de entrega podem estar pendentes.')
  }
}

export function startFailureAlerts() {
  let running = false
  const scan = async () => {
    if (running) return
    running = true
    try { await scanFailureAlerts() }
    catch (error) { console.error('[failure-alerts] scan failed:', error) }
    finally { running = false }
  }
  void scan()
  setInterval(() => { void scan() }, 60_000).unref()
}
