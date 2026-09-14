import assert from 'node:assert/strict'
import { describe, it, type TestContext } from 'node:test'
// Inject the database boundary before loading the service; tests never connect to a database.
const unexpectedDatabaseCall = async (..._args: any[]): Promise<any> => { throw new Error('Unexpected database call') }
const prisma = {
  empresa: { findUnique: unexpectedDatabaseCall },
  whatsAppConnection: { findUnique: unexpectedDatabaseCall, update: unexpectedDatabaseCall },
  whatsAppTemplate: {
    findMany: unexpectedDatabaseCall, findFirst: unexpectedDatabaseCall,
    upsert: unexpectedDatabaseCall, updateMany: unexpectedDatabaseCall,
  },
  $transaction: unexpectedDatabaseCall,
}
;(globalThis as any).prisma = prisma
const { buildMetaTemplateCreateRequest, buildMetaTemplatePayload, createMetaTemplate, syncMetaTemplates, getApprovedWhatsAppTemplate } = await import('./whatsapp-templates.js')

describe('Meta WhatsApp template payload', () => {
  it('builds a utility template with examples and buttons', () => {
    const payload = buildMetaTemplatePayload({
      name: 'Confirmacao Consulta',
      language: 'pt_BR',
      category: 'UTILITY',
      headerText: 'Consulta de {{1}}',
      headerExamples: ['avaliacao'],
      bodyText: 'Ola {{1}}, sua consulta sera em {{2}}.',
      bodyExamples: ['Maria', '22/07 as 14h'],
      footerText: 'Equipe SellClin',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'URL', text: 'Ver detalhes', url: 'https://sellclin.com' },
      ],
    })

    assert.equal(payload.name, 'confirmacao_consulta')
    assert.equal(payload.category, 'UTILITY')
    assert.deepEqual(payload.components[0].example.header_text, ['avaliacao'])
    assert.deepEqual(payload.components[1].example.body_text, [['Maria', '22/07 as 14h']])
    assert.equal(payload.components[3].buttons.length, 2)
  })

  it('rejects skipped variables and missing examples', () => {
    assert.throws(() => buildMetaTemplatePayload({
      name: 'lembrete_consulta',
      language: 'pt_BR',
      category: 'UTILITY',
      bodyText: 'Ola {{1}}, confirme em {{3}}.',
      bodyExamples: ['Maria', 'amanha'],
    }), /sem pular numeros/)

    assert.throws(() => buildMetaTemplatePayload({
      name: 'lembrete_consulta',
      language: 'pt_BR',
      category: 'UTILITY',
      bodyText: 'Ola {{1}}.',
    }), /exemplo para cada variavel/)

    assert.throws(() => buildMetaTemplatePayload({
      name: 'variavel_malformada',
      language: 'pt_BR',
      category: 'UTILITY',
      bodyText: 'Ola {{1}}, use tambem {{nome}}.',
      bodyExamples: ['Maria'],
    }), /variaveis numeradas/)
  })

  it('rejects unsafe dynamic URLs', () => {
    assert.throws(() => buildMetaTemplatePayload({
      name: 'acompanhar_pedido',
      language: 'pt_BR',
      category: 'UTILITY',
      bodyText: 'Acompanhe seu pedido.',
      buttons: [{ type: 'URL', text: 'Acompanhar', url: 'https://sellclin.com/{{1}}' }],
    }), /URL HTTPS estatica/)
  })

  it('builds the exact Meta request for an appointment reminder utility template', () => {
    const request = buildMetaTemplateCreateRequest('123456789012345', 'meta-test-token', {
      name: 'Lembrete de agendamento',
      language: 'pt_BR',
      category: 'UTILITY',
      headerText: 'Lembrete de agendamento',
      bodyText: 'Ola, {{1}}. Seu atendimento na {{2}} esta agendado para {{3}}. Responda para confirmar ou solicitar alteracao.',
      bodyExamples: ['Maria', 'Clinica Boca', '25/07 as 14h'],
      footerText: 'Mensagem referente ao seu agendamento',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'QUICK_REPLY', text: 'Solicitar alteracao' },
      ],
    })

    assert.match(request.endpoint, /\/123456789012345\/message_templates$/)
    assert.equal(request.options.method, 'POST')
    assert.equal(request.options.headers.Authorization, 'Bearer meta-test-token')
    assert.equal(request.options.headers['Content-Type'], 'application/json')

    const postedBody = JSON.parse(request.options.body)
    assert.equal(postedBody.name, 'lembrete_de_agendamento')
    assert.equal(postedBody.category, 'UTILITY')
    assert.equal(postedBody.language, 'pt_BR')
    assert.equal(postedBody.allow_category_change, true)
    assert.deepEqual(postedBody.components[1].example.body_text, [[
      'Maria',
      'Clinica Boca',
      '25/07 as 14h',
    ]])
    assert.deepEqual(postedBody.components[3].buttons, [
      { type: 'QUICK_REPLY', text: 'Confirmar' },
      { type: 'QUICK_REPLY', text: 'Solicitar alteracao' },
    ])
  })
})

function mockTemplateStore(t: TestContext, initial: any[] = []) {
  const records = initial.map((record) => ({
    companyId: 4, name: 'lembrete', language: 'pt_BR', category: 'UTILITY',
    components: [], updatedAt: new Date(0), lastSyncedAt: new Date(0), ...record,
  }))
  t.mock.method(prisma.empresa, 'findUnique', async () => ({ whatsappProvider: 'meta' }))
  t.mock.method(prisma.whatsAppConnection, 'findUnique', async () => ({
    id: 8, companyId: 4, provider: 'meta', accessToken: 'test-token', wabaId: '1234',
  }))
  t.mock.method(prisma.whatsAppConnection, 'update', async () => ({}))
  const transaction = t.mock.method(prisma, '$transaction', async (callback: any) => callback(prisma))
  t.mock.method(prisma.whatsAppTemplate, 'findMany', async ({ where }: any) => records.filter((r) => r.companyId === where.companyId))
  t.mock.method(prisma.whatsAppTemplate, 'findFirst', async ({ where }: any) => records.find((r) => r.companyId === where.companyId && r.id === where.id) || null)
  const upsert = t.mock.method(prisma.whatsAppTemplate, 'upsert', async (args: any) => {
    const key = args.where.companyId_name_language
    const record = records.find((r) => r.companyId === key.companyId && r.name === key.name && r.language === key.language)
    if (record) { Object.assign(record, args.update, { updatedAt: new Date() }); return record }
    const created = { id: records.length + 1, ...args.create, updatedAt: new Date() }
    records.push(created)
    return created
  })
  const reconcile = t.mock.method(prisma.whatsAppTemplate, 'updateMany', async ({ where, data }: any) => {
    const missing = records.filter((r) => r.companyId === where.companyId && r.updatedAt < where.updatedAt.lt
      && !(where.NOT?.OR || []).some((key: any) => key.name === r.name && key.language === r.language))
    missing.forEach((r) => Object.assign(r, data))
    return { count: missing.length }
  })
  return { records, transaction, upsert, reconcile }
}

const templateInput = { name: 'lembrete', language: 'pt_BR', category: 'UTILITY' as const, bodyText: 'Sua consulta foi confirmada.' }

describe('Meta template synchronization and submission', () => {
  it('does not confirm submission when Meta returns success without an ID', async (t) => {
    const store = mockTemplateStore(t)
    t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => Response.json(options.method === 'POST' ? { success: true } : { data: [] }))
    await assert.rejects(createMetaTemplate(4, templateInput), /nao confirmou o ID/)
    assert.equal(store.upsert.mock.callCount(), 0)
  })

  it('updates pending templates, follows all pages and marks only missing company templates', async (t) => {
    const store = mockTemplateStore(t, [
      { id: 1, externalId: '10', status: 'PENDING' },
      { id: 2, name: 'ausente', externalId: '20', status: 'PENDING' },
      { id: 3, companyId: 99, name: 'outra_clinica', status: 'APPROVED' },
      { id: 4, name: 'segunda_pagina', externalId: '40', status: 'PENDING' },
      { id: 5, name: 'criado_durante_consulta', status: 'PENDING', updatedAt: new Date(Date.now() + 60_000) },
    ])
    const fetchMock = t.mock.method(globalThis, 'fetch', async (url: any) => {
      if (String(url).includes('after=next')) return Response.json({ data: [{ id: '40', name: 'segunda_pagina', language: 'pt_BR', status: 'APPROVED' }] })
      return Response.json({ data: [{ id: '10', name: 'lembrete', language: 'pt_BR', status: 'APPROVED' }], paging: { next: 'https://graph.facebook.com/v19.0/1234/message_templates?after=next' } })
    })
    await syncMetaTemplates(4)
    assert.equal(fetchMock.mock.callCount(), 2)
    assert.deepEqual(store.records.map((r) => r.status), ['APPROVED', 'NOT_FOUND', 'APPROVED', 'APPROVED', 'PENDING'])
    assert.equal(store.reconcile.mock.calls[0].arguments[0].where.companyId, 4)
  })

  it('does not modify saved statuses on malformed or incomplete Meta responses', async (t) => {
    const store = mockTemplateStore(t, [{ id: 1, status: 'APPROVED' }])
    t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true }))
    await assert.rejects(syncMetaTemplates(4), /lista de templates incompleta/)
    assert.equal(store.transaction.mock.callCount(), 0)
    assert.equal(store.records[0].status, 'APPROVED')
  })

  it('does not reconcile if a later page is denied', async (t) => {
    const store = mockTemplateStore(t, [{ id: 1, status: 'PENDING' }])
    t.mock.method(globalThis, 'fetch', async (url: any) => String(url).includes('after=next')
      ? Response.json({ error: { message: 'Permission denied', code: 200 } }, { status: 403 })
      : Response.json({ data: [], paging: { next: 'https://graph.facebook.com/v19.0/1234/message_templates?after=next' } }))
    await assert.rejects(syncMetaTemplates(4), /Permission denied.*1234.*200/)
    assert.equal(store.transaction.mock.callCount(), 0)
  })

  it('recreates a stale local template instead of returning its old pending status', async (t) => {
    const store = mockTemplateStore(t, [{ id: 1, status: 'PENDING', externalId: '10' }])
    const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => Response.json(
      options.method === 'POST' ? { id: '99', status: 'PENDING', category: 'UTILITY' } : { data: [] },
    ))
    const result = await createMetaTemplate(4, templateInput)
    assert.equal(result.externalId, '99')
    assert.equal(result.id, 1)
    assert.equal(store.records.length, 1)
    assert.equal(fetchMock.mock.callCount(), 2)
  })

  it('returns the current Meta status for an existing template without duplicating submission', async (t) => {
    mockTemplateStore(t, [{ id: 1, status: 'PENDING', externalId: '10' }])
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [{
      id: '10', name: 'lembrete', language: 'pt_BR', status: 'APPROVED', category: 'UTILITY',
    }] }))
    const result = await createMetaTemplate(4, templateInput)
    assert.equal(result.status, 'APPROVED')
    assert.equal(fetchMock.mock.callCount(), 1)
  })

  it('does not recover a timed-out creation from an unconfirmed local record', async (t) => {
    mockTemplateStore(t, [{ id: 1, status: 'PENDING', externalId: '10' }])
    t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
      if (options.method === 'POST') throw new DOMException('Timeout', 'TimeoutError')
      return Response.json({ data: [] })
    })
    await assert.rejects(createMetaTemplate(4, templateInput), /demorou para responder/)
  })

  it('blocks sending a previously approved template that is now paused at Meta', async (t) => {
    mockTemplateStore(t, [{ id: 1, status: 'APPROVED', externalId: '10' }])
    t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [{
      id: '10', name: 'lembrete', language: 'pt_BR', status: 'PAUSED',
    }] }))
    await assert.rejects(getApprovedWhatsAppTemplate(4, 1), /nao esta aprovado/)
  })

  it('rechecks even a recently cached approval before starting a campaign', async (t) => {
    mockTemplateStore(t, [{ id: 1, status: 'APPROVED', externalId: '10', lastSyncedAt: new Date() }])
    const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [{
      id: '10', name: 'lembrete', language: 'pt_BR', status: 'DISABLED',
    }] }))
    await assert.rejects(getApprovedWhatsAppTemplate(4, 1, true), /nao esta aprovado/)
    assert.equal(request.mock.callCount(), 1)
  })
})
