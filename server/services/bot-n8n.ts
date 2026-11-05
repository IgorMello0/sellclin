import { randomUUID } from 'node:crypto'
import { integrationHttpClient } from './integration-http.js'
import { botDecisionSchema } from './bot-policy.js'
import { BotProviderError } from './bot-provider.js'

export function validWorkflowUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search && !url.port && !url.pathname.includes('/webhook-test/')
  } catch { return false }
}
export function botConnectionReady(config: any) {
  return Boolean(config && (config.executionMode === 'n8n' ? config.n8nSecret && config.n8nWebhookUrl : config.apiKey))
}
export async function callBotWorkflow(config: any, payload: Record<string, unknown>) {
  if (!validWorkflowUrl(config.n8nWebhookUrl || '') || !config.n8nSecret) throw new BotProviderError('workflow_configuration')
  const eventId = String(payload.eventId || `test-${randomUUID()}`)
  const timeout = Math.min(25, Math.max(5, Number(config.n8nTimeoutSeconds) || 20))
  const signal = AbortSignal.timeout(timeout * 1000)
  try {
    const response = await integrationHttpClient.fetch(config.n8nWebhookUrl, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.n8nSecret}`, 'X-SellClin-Event-Id': eventId, 'X-SellClin-Schema-Version': '1.0' },
      body: JSON.stringify({ ...payload, eventId, schemaVersion: '1.0', sentAt: new Date().toISOString() }),
    }, undefined, { publicOnly: true, maxResponseBytes: 65536 })
    if (!response.ok) throw new BotProviderError(response.status === 401 || response.status === 403 ? 'workflow_auth' : 'workflow_unavailable', response.status)
    const text = await response.text()
    if (Buffer.byteLength(text) > 65536) throw new BotProviderError('workflow_invalid_response')
    const decision = botDecisionSchema.parse(JSON.parse(text))
    return { decision, inputTokens: 0, outputTokens: 0, httpStatus: response.status }
  } catch (error) {
    if (error instanceof BotProviderError) throw error
    if (signal.aborted) throw new BotProviderError('workflow_timeout')
    throw new BotProviderError('workflow_invalid_response')
  }
}
