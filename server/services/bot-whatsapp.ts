import { integrationHttpClient } from './integration-http.js'
import { sendUazapiRequest } from './uazapi-whatsapp.js'

export async function sendBotWhatsApp(conversation: any, company: any, text: string): Promise<string> {
  const phone = String(conversation.phone || '').replace(/\D/g, '')
  if (!phone || !text || text.length > 4096) throw new Error('invalid_message')
  if (!conversation.lastInboundAt || Date.now() - new Date(conversation.lastInboundAt).getTime() >= 24 * 3600000) throw new Error('window_closed')
  if (company.whatsappProvider === 'uazapi' && company.uazapiToken) {
    const baseUrl = process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL
    if (!baseUrl) throw new Error('channel_unavailable')
    const result = await sendUazapiRequest({ baseUrl, token: company.uazapiToken, path: '/send/text', body: { number: phone, text, linkPreview: false } })
    const id = result.data?.messageid || result.data?.messageId || result.data?.id
    if (!result.response.ok || !id) throw new Error('delivery_uncertain')
    return String(id)
  }
  if (company.whatsappProvider === 'meta' && company.metaToken && company.metaPhoneNumberId) {
    const version = String(process.env.META_GRAPH_VERSION || 'v22.0').replace(/^v?/, 'v')
    const response = await integrationHttpClient.fetch(`https://graph.facebook.com/${version}/${company.metaPhoneNumberId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${company.metaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text', text: { body: text, preview_url: false } }),
    })
    const payload: any = await response.json()
    if (!response.ok || !payload.messages?.[0]?.id) throw new Error('delivery_uncertain')
    return payload.messages[0].id
  }
  throw new Error('channel_unavailable')
}
