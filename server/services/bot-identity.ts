// IDs are scoped by clinic. Test memory is deliberately separate from live memory.
export function botIdentity(companyId: number, agentId: number, mode: string, phone?: string, conversationId?: number) {
  const raw = String(phone || '')
  const digits = raw.includes('@') && !/@(s\.whatsapp\.net|c\.us)$/.test(raw) ? '' : raw.split('@')[0].replace(/\D/g, '')
  const normalized = /^\d{8,15}$/.test(digits) ? digits : null
  const live = mode === 'live'
  const conversationKey = Number.isSafeInteger(conversationId) && conversationId! > 0 ? `clinic:${companyId}:conversation:${conversationId}` : null
  const contactId = live ? normalized ? `clinic:${companyId}:phone:${normalized}` : conversationKey : `test:clinic:${companyId}:bot:${agentId}:${mode}${normalized ? ':phone:' + normalized : ''}`
  return {
    contact: { id: contactId, phone: normalized },
    conversation: { id: live ? conversationKey : contactId, memoryKey: contactId, isTest: !live },
  }
}
