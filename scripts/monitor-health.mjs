import { readFile, writeFile, rename } from 'node:fs/promises'

const url = process.env.MONITOR_HEALTH_URL || 'https://sellclin.com/api/health'
const email = process.env.MONITOR_ALERT_EMAIL
const apiKey = process.env.RESEND_API_KEY
const stateFile = process.env.MONITOR_STATE_FILE || './sellclin-health-state.json'
if (!email || !apiKey) throw new Error('Configure MONITOR_ALERT_EMAIL e RESEND_API_KEY no monitor externo')
let state = { failures: 0, alerted: false }
try { state = JSON.parse(await readFile(stateFile, 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
let healthy = false
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const body = await response.json()
  healthy = response.ok && body.success === true && body.data?.status === 'ok' && body.data?.database === 'connected'
} catch { /* A timeout, connection failure or invalid response counts as failure. */ }
state.failures = healthy ? 0 : state.failures + 1
const outage = !healthy && state.failures >= 3 && !state.alerted
const recovery = healthy && state.alerted
if (outage || recovery) {
  const subject = outage ? '[SellClin] Sistema indisponível' : '[SellClin] Sistema voltou a responder'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'SellClin <noreply@sellclin.com>', to: email,
      subject, text: `${subject}\nVerificação: ${url}\nHorário: ${new Date().toISOString()}\n${outage ? 'Três verificações consecutivas falharam. Verifique a VPS, o backend e o banco.' : 'A API e o banco responderam normalmente.'}` }),
  })
  if (!response.ok) throw new Error(`Falha ao enviar alerta: HTTP ${response.status}`)
  state.alerted = outage
}
await writeFile(`${stateFile}.tmp`, JSON.stringify(state), { mode: 0o600 })
await rename(`${stateFile}.tmp`, stateFile)
console.log(healthy ? 'SellClin saudável' : `SellClin indisponível: ${state.failures} verificações consecutivas`)
