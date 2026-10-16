import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('outage is grouped, recovery is notified, and email failures are retried', async () => {
  const directory = await mkdtemp(join(process.cwd(), '.monitor-test-'))
  const stateFile = join(directory, 'state.json')
  const script = new URL('./monitor-health.mjs', import.meta.url).href
  function run(healthy, emailOk = true) {
    return spawnSync(process.execPath, ['--input-type=module', '-e', `
      globalThis.fetch = async url => {
        if (url.includes('resend.com')) {
          console.log('EMAIL'); return { ok: ${emailOk}, status: 503 };
        }
        return { ok: ${healthy}, json: async () => ({ success: ${healthy}, data: { status: 'ok', database: 'connected' } }) };
      };
      await import(${JSON.stringify(script)});
    `], { encoding: 'utf8', env: { ...process.env, MONITOR_ALERT_EMAIL: 'test@example.com', RESEND_API_KEY: 'fake', MONITOR_STATE_FILE: stateFile } })
  }
  try {
    const first = run(false)
    assert.equal(first.status, 0, first.stderr || String(first.error))
    assert.equal(first.stdout.includes('EMAIL'), false)
    assert.equal(run(false).stdout.includes('EMAIL'), false)
    assert.notEqual(run(false, false).status, 0)
    assert.equal(JSON.parse(await readFile(stateFile, 'utf8')).alerted, false)
    assert.equal(run(false).stdout.includes('EMAIL'), true)
    assert.equal(run(false).stdout.includes('EMAIL'), false)
    assert.equal(run(true).stdout.includes('EMAIL'), true)
    assert.equal(run(true).stdout.includes('EMAIL'), false)
    assert.deepEqual(JSON.parse(await readFile(stateFile, 'utf8')), { failures: 0, alerted: false })
  } finally { await rm(directory, { recursive: true, force: true }) }
})
