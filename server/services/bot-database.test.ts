// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll, afterAll, expect, it } from 'vitest'

const db = new PGlite()
beforeAll(async () => {
  await db.exec(`CREATE TABLE empresas(id INT PRIMARY KEY, is_active BOOLEAN DEFAULT true, whatsapp_provider TEXT);
    CREATE TABLE agentes_ia(id SERIAL PRIMARY KEY, company_id INT REFERENCES empresas(id), is_active BOOLEAN DEFAULT true);
    CREATE TABLE conversas(id INT PRIMARY KEY, company_id INT REFERENCES empresas(id), agent_id INT);
    CREATE TABLE mensagens(id SERIAL PRIMARY KEY, conversation_id INT REFERENCES conversas(id), sender TEXT, provider_message_id TEXT, created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, UNIQUE(conversation_id,provider_message_id));
    INSERT INTO empresas(id,whatsapp_provider) VALUES (1,'meta'),(2,'uazapi'),(3,'evolution');
    INSERT INTO agentes_ia(company_id) VALUES(1),(1),(2),(3);
    INSERT INTO conversas(id,company_id) VALUES(11,1),(22,2),(33,3),(44,1);
    INSERT INTO mensagens(conversation_id,sender,provider_message_id) VALUES(44,'profissional','old-human');`)
  const sql = await readFile(new URL('../../database/bot-configuracoes.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  await db.exec(sql)
  const flows = await readFile(new URL('../../database/bot-flows.sql', import.meta.url), 'utf8')
  await db.exec(flows)
  await db.exec(flows)
}, 30000)
afterAll(async () => { await db.close() })
it('is repeatable and does not activate old agents or steal ongoing human conversations', async () => {
  expect((await db.query('SELECT count(*)::int AS n FROM agentes_ia WHERE is_active')).rows).toEqual([{ n: 0 }])
  expect((await db.query('SELECT paused,reason FROM bot_sessions WHERE conversation_id=44')).rows).toEqual([{ paused: true, reason: 'manual' }])
})
it('guarantees one active bot per clinic even with competing writes', async () => {
  const results = await Promise.allSettled([db.query('UPDATE agentes_ia SET is_active=true, activated_at=CURRENT_TIMESTAMP WHERE id=1'), db.query('UPDATE agentes_ia SET is_active=true, activated_at=CURRENT_TIMESTAMP WHERE id=2')])
  expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
  await db.exec('UPDATE agentes_ia SET is_active=true, activated_at=CURRENT_TIMESTAMP WHERE id=3')
  expect((await db.query('SELECT count(*)::int AS n FROM agentes_ia WHERE is_active')).rows).toEqual([{ n: 2 }])
})
it('atomically enqueues Meta and Uazapi messages once, in the correct clinic', async () => {
  await db.exec(`INSERT INTO bot_configuracoes(agent_id,verified_at) SELECT id,CURRENT_TIMESTAMP FROM agentes_ia WHERE is_active;
    INSERT INTO mensagens(conversation_id,sender,provider_message_id) VALUES(11,'cliente','meta-1'),(22,'cliente','uaz-1'),(33,'cliente','evo-1');
    INSERT INTO mensagens(conversation_id,sender,provider_message_id) VALUES(11,'cliente','meta-1') ON CONFLICT DO NOTHING;`)
  expect((await db.query('SELECT company_id,conversation_id FROM bot_runs ORDER BY company_id')).rows).toEqual([{ company_id: 1, conversation_id: 11 }, { company_id: 2, conversation_id: 22 }])
  await db.exec(`BEGIN; INSERT INTO mensagens(conversation_id,sender,provider_message_id) VALUES(11,'cliente','rollback'); ROLLBACK;`)
  expect((await db.query('SELECT count(*)::int AS n FROM bot_runs')).rows).toEqual([{ n: 2 }])
})
it('does not enqueue bot echoes and pauses on a human message', async () => {
  await db.exec(`INSERT INTO mensagens(conversation_id,sender,provider_message_id) VALUES(11,'bot','bot-1'),(22,'profissional','human-1');`)
  expect((await db.query('SELECT count(*)::int AS n FROM bot_runs')).rows).toEqual([{ n: 2 }])
  expect((await db.query('SELECT paused,reason FROM bot_sessions WHERE conversation_id=22')).rows).toEqual([{ paused: true, reason: 'manual' }])
})
