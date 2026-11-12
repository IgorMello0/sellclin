import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { COPIED_FUNNEL_PREFIX, ORIGINAL_FUNNEL_CODES, copiedFunnelCode, copiedStageCode, isOriginalFunnel, isReservedFunnelCode, operationKey, parseCopiedFunnel, parseCopiedStage } from '../utils/funnel-stages.js'

export const router = Router()
router.use(auth(), requireModule('funnel'))
router.use(ownerConfiguration)

// Configuração padrão dos funis (fallback)
const DEFAULT_FUNNELS = [
  {
    code: 'prospecting',
    label: 'Prospecção',
    icon: 'person_search',
    order: 0,
    stages: [
      { code: 'prospect_lead', label: 'Novos Leads', color: 'bg-blue-500', order: 0 },
      { code: 'prospect_qualified', label: 'Qualificados', color: 'bg-indigo-500', order: 1 },
      { code: 'prospect_scheduled', label: 'Agendados', color: 'bg-violet-500', order: 2 },
      { code: 'prospect_attended', label: 'Compareceu', color: 'bg-emerald-500', order: 3 },
    ]
  },
  {
    code: 'commercial',
    label: 'Comercial',
    icon: 'handshake',
    order: 1,
    stages: [
      { code: 'comercial_proposal', label: 'Proposta', color: 'bg-orange-500', order: 0 },
      { code: 'comercial_follow', label: 'Follow-up', color: 'bg-amber-500', order: 1 },
      { code: 'comercial_closed', label: 'Fechado', color: 'bg-green-600', order: 2 },
    ]
  }
]

// Sales remains available as a template for clinics with only the two default tabs.
const SALES_TEMPLATE = {
  code: 'sales', label: 'Vendas', icon: 'payments',
  stages: [
    { code: 'sales_payment', label: 'Pagamento', color: 'bg-cyan-500', order: 0 },
    { code: 'sales_contract', label: 'Contrato', color: 'bg-blue-600', order: 1 },
    { code: 'sales_post', label: 'Pós-Venda', color: 'bg-purple-500', order: 2 },
  ],
}

/**
 * GET / — Buscar os funis da empresa logada
 * Se não existirem, retorna os padrões e popula automaticamente
 */
router.get('/', auth(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(400).json(createErrorResponse('Empresa não identificada', 400))
    }

    let funnels = await prisma.funnelConfig.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      include: {
        stages: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    })

    // Se não tem funis configurados, popular com os padrões
    if (funnels.length === 0) {
      await seedDefaults(companyId)
      funnels = await prisma.funnelConfig.findMany({
        where: { companyId, isActive: true },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: {
          stages: {
            where: { isActive: true },
            orderBy: { order: 'asc' }
          }
        }
      })
    }

    res.json(createSuccessResponse(funnels))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao buscar funis:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar funis', 500))
  }
})

/**
 * POST / — Criar um novo funil para a empresa
 */
router.post('/', auth(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(400).json(createErrorResponse('Empresa não identificada', 400))
    }

    const { code, label, icon, order } = req.body
    if (!code || !label) {
      return res.status(400).json(createErrorResponse('Código e nome do funil são obrigatórios', 400))
    }
    const normalizedCode = String(code).toLowerCase().replace(/\s+/g, '_')
    if (isReservedFunnelCode(normalizedCode)) {
      return res.status(400).json(createErrorResponse('Use a opção Duplicar funil original para criar uma cópia.', 400))
    }

    const funnel = await prisma.funnelConfig.create({
      data: {
        companyId,
        code: normalizedCode,
        label,
        icon: icon || 'filter_alt',
        order: order ?? 99
      }
    })

    res.status(201).json(createSuccessResponse(funnel))
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json(createErrorResponse('Já existe um funil com este código nesta empresa', 400))
    }
    console.error('[FunnelConfig] Erro ao criar funil:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar funil', 500))
  }
})

router.post('/duplicate', async (req, res) => {
  const companyId = req.user?.companyId
  const name = typeof req.body?.operationName === 'string' ? req.body.operationName.trim() : ''
  const operation = operationKey(name)
  const requested = req.body?.templates
  if (!companyId || !operation || name.length > 60 || !Array.isArray(requested) ||
      !requested.length || requested.length > ORIGINAL_FUNNEL_CODES.length ||
      !requested.every(code => typeof code === 'string' && isOriginalFunnel(code))) {
    return res.status(400).json(createErrorResponse('Informe o nome da operação e selecione os funis originais.', 400))
  }

  try {
    const created = await prisma.$transaction(async tx => {
      const funnels = await tx.funnelConfig.findMany({
        where: { companyId },
        include: { stages: { where: { isActive: true }, orderBy: { order: 'asc' } } },
      })
      const existing = new Set(funnels.map(funnel => funnel.code))
      let order = Math.max(-1, ...funnels.map(funnel => funnel.order)) + 1
      const copies = []
      for (const template of ORIGINAL_FUNNEL_CODES) {
        const code = copiedFunnelCode(operation, template)
        if (!requested.includes(template) || existing.has(code)) continue
        const configured = funnels.find(funnel => funnel.code === template && funnel.isActive && funnel.stages.length > 0)
        const source = configured ?? [...DEFAULT_FUNNELS, SALES_TEMPLATE].find(funnel => funnel.code === template)!
        copies.push(await tx.funnelConfig.create({
          data: {
            companyId, code, label: `${source.label} · ${name}`, icon: source.icon, order: order++,
            stages: { create: source.stages.map(stage => ({
              code: copiedStageCode(operation, template, stage.code),
              label: stage.label, color: stage.color, order: stage.order,
              isTransition: 'isTransition' in stage && stage.isTransition === true,
            })) },
          },
          include: { stages: { orderBy: { order: 'asc' } } },
        }))
      }
      return copies
    })
    if (!created.length) return res.status(409).json(createErrorResponse('Os funis selecionados já existem nessa operação.', 409))
    res.status(201).json(createSuccessResponse(created))
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json(createErrorResponse('Uma cópia já foi criada nessa operação. Atualize a lista.', 409))
    console.error('[FunnelConfig] Erro ao duplicar funis:', error)
    res.status(500).json(createErrorResponse('Não foi possível duplicar os funis.', 500))
  }
})

/**
 * PUT /:id — Atualizar um funil existente
 */
router.put('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { label, icon, order, isActive } = req.body
    const current = await prisma.funnelConfig.findFirst({
      where: { id, companyId: req.user!.companyId },
      select: { id: true, code: true },
    })
    if (!current) return res.status(404).json(createErrorResponse('Funil não encontrado', 404))
    if (parseCopiedFunnel(current.code) && isActive === false) {
      return res.status(400).json(createErrorResponse('Remova a cópia depois de transferir os leads desse funil.', 400))
    }

    const funnel = await prisma.funnelConfig.update({
      where: { id: current.id },
      data: { label, icon, order, isActive },
      include: { stages: { orderBy: { order: 'asc' } } }
    })

    res.json(createSuccessResponse(funnel))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao atualizar funil:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar funil', 500))
  }
})

/**
 * DELETE /:id — Remover um funil
 */
router.delete('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const companyId = req.user?.companyId

    // Buscar todas as etapas desse funil para mover leads
    const funnel = await prisma.funnelConfig.findFirst({
      where: { id, companyId },
      include: { stages: true }
    })

    if (!funnel) {
      return res.status(404).json(createErrorResponse('Funil não encontrado', 404))
    }

    // Buscar a primeira etapa do primeiro funil ativo da empresa (para mover leads órfãos)
    const firstFunnel = await prisma.funnelConfig.findFirst({
      where: { companyId: companyId!, id: { not: id }, isActive: true, NOT: { code: { startsWith: COPIED_FUNNEL_PREFIX } } },
      orderBy: { order: 'asc' },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } }
    })

    const fallbackStageCode = firstFunnel?.stages[0]?.code || 'prospect_lead'

    // Mover leads das etapas que serão deletadas
    const stageCodes = funnel.stages.map(s => s.code)
    if (parseCopiedFunnel(funnel.code)) {
      const occupied = await prisma.lead.count({ where: { companyId, status: { in: stageCodes } } })
      if (occupied) return res.status(409).json(createErrorResponse('Transfira os leads antes de remover este funil.', 409))
    }
    if (stageCodes.length > 0) {
      await prisma.lead.updateMany({
        where: { status: { in: stageCodes }, companyId },
        data: { status: fallbackStageCode }
      })
    }

    await prisma.funnelConfig.delete({ where: { id } })

    res.json(createSuccessResponse({ id, movedLeadsTo: fallbackStageCode }))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao deletar funil:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar funil', 500))
  }
})

// ==================== ETAPAS (STAGES) ====================

/**
 * POST /:funnelId/stages — Adicionar etapa a um funil
 */
router.post('/:funnelId/stages', auth(), async (req, res) => {
  try {
    const funnelId = Number(req.params.funnelId)
    const { code, label, color, order, isTransition } = req.body

    if (!code || !label) {
      return res.status(400).json(createErrorResponse('Código e nome da etapa são obrigatórios', 400))
    }

    const funnel = await prisma.funnelConfig.findFirst({
      where: { id: funnelId, companyId: req.user!.companyId },
      select: { id: true, code: true },
    })
    if (!funnel) return res.status(404).json(createErrorResponse('Funil não encontrado', 404))
    const normalizedCode = String(code).toLowerCase().replace(/\s+/g, '_')
    if (isReservedFunnelCode(normalizedCode)) {
      return res.status(400).json(createErrorResponse('Código de etapa reservado para cópias.', 400))
    }
    const copy = parseCopiedFunnel(funnel.code)

    const stage = await prisma.funnelStage.create({
      data: {
        funnelId,
        code: copy ? copiedStageCode(copy.operation, copy.template, normalizedCode) : normalizedCode,
        label,
        color: color || 'bg-blue-500',
        order: order ?? 99,
        isTransition: isTransition || false
      }
    })

    res.status(201).json(createSuccessResponse(stage))
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json(createErrorResponse('Já existe uma etapa com este código neste funil', 400))
    }
    console.error('[FunnelConfig] Erro ao criar etapa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar etapa', 500))
  }
})

/**
 * PUT /stages/:id — Atualizar uma etapa
 */
router.put('/stages/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { label, color, order, isTransition, isActive } = req.body
    const current = await prisma.funnelStage.findFirst({
      where: { id, funnel: { companyId: req.user!.companyId } },
      select: { id: true, code: true },
    })
    if (!current) return res.status(404).json(createErrorResponse('Etapa não encontrada', 404))
    if (parseCopiedStage(current.code) && isActive === false) {
      return res.status(400).json(createErrorResponse('Para remover uma etapa da cópia, transfira os leads primeiro.', 400))
    }

    const stage = await prisma.funnelStage.update({
      where: { id: current.id },
      data: { label, color, order, isTransition, isActive }
    })

    res.json(createSuccessResponse(stage))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao atualizar etapa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar etapa', 500))
  }
})

/**
 * DELETE /stages/:id — Remover uma etapa
 */
router.delete('/stages/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const companyId = req.user?.companyId

    const stage = await prisma.funnelStage.findFirst({
      where: { id, funnel: { companyId } },
      include: { funnel: { include: { stages: { where: { isActive: true }, orderBy: { order: 'asc' } } } } }
    })

    if (!stage) {
      return res.status(404).json(createErrorResponse('Etapa não encontrada', 404))
    }
    if (parseCopiedStage(stage.code) && await prisma.lead.count({ where: { companyId, status: stage.code } })) {
      return res.status(409).json(createErrorResponse('Transfira os leads antes de remover esta etapa.', 409))
    }

    // Mover leads desta etapa para a primeira etapa do mesmo funil
    const fallbackStage = stage.funnel.stages.find(s => s.id !== id)
    const fallbackCode = fallbackStage?.code || 'prospect_lead'

    await prisma.lead.updateMany({
      where: { status: stage.code, companyId },
      data: { status: fallbackCode }
    })

    await prisma.funnelStage.delete({ where: { id } })

    res.json(createSuccessResponse({ id, movedLeadsTo: fallbackCode }))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao deletar etapa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar etapa', 500))
  }
})

/**
 * PUT /reorder — Reordenar funis e etapas em batch
 */
router.put('/reorder/batch', auth(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(400).json(createErrorResponse('Empresa não identificada', 400))
    }
    const { funnels } = req.body // Array de { id, order?, stages?: [{ id, order }] }

    if (!funnels || !Array.isArray(funnels)) {
      return res.status(400).json(createErrorResponse('Dados de reordenação inválidos', 400))
    }

    const funnelIds = funnels.map((funnel: any) => Number(funnel.id)).filter(Boolean)
    const stageIds = funnels.flatMap((funnel: any) =>
      Array.isArray(funnel.stages)
        ? funnel.stages.map((stage: any) => Number(stage.id)).filter(Boolean)
        : []
    )
    const [ownedFunnels, ownedStages] = await Promise.all([
      prisma.funnelConfig.count({
        where: { id: { in: funnelIds }, companyId },
      }),
      prisma.funnelStage.count({
        where: { id: { in: stageIds }, funnel: { companyId } },
      }),
    ])
    if (ownedFunnels !== new Set(funnelIds).size || ownedStages !== new Set(stageIds).size) {
      return res.status(403).json(createErrorResponse('A reordenacao contem itens de outra clinica', 403))
    }

    const operations = []

    for (const funnel of [...funnels].sort((first, second) => Number(first.id) - Number(second.id))) {
      if (funnel.order !== undefined) {
        operations.push(
          prisma.funnelConfig.update({
            where: { id: Number(funnel.id), companyId },
            data: { order: funnel.order }
          })
        )
      }

      if (funnel.stages) {
        for (const stage of funnel.stages) {
          operations.push(
            prisma.funnelStage.update({
              where: { id: Number(stage.id) },
              data: { order: stage.order }
            })
          )
        }
      }
    }

    await prisma.$transaction(operations)

    res.json(createSuccessResponse({ reordered: true }))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao reordenar:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao reordenar', 500))
  }
})

/**
 * POST /seed — Restaurar funis padrão (reseta tudo)
 */
router.post('/seed', auth(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(400).json(createErrorResponse('Empresa não identificada', 400))
    }

    // Deletar funis existentes
    await prisma.funnelConfig.deleteMany({ where: { companyId, NOT: { code: { startsWith: COPIED_FUNNEL_PREFIX } } } })

    // Popular com padrões
    await seedDefaults(companyId)

    const funnels = await prisma.funnelConfig.findMany({
      where: { companyId },
      orderBy: { order: 'asc' },
      include: { stages: { orderBy: { order: 'asc' } } }
    })

    res.json(createSuccessResponse(funnels))
  } catch (error: any) {
    console.error('[FunnelConfig] Erro ao restaurar padrões:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao restaurar padrões', 500))
  }
})

// ==================== HELPERS ====================

async function seedDefaults(companyId: number) {
  for (const funnel of DEFAULT_FUNNELS) {
    await prisma.funnelConfig.create({
      data: {
        companyId,
        code: funnel.code,
        label: funnel.label,
        icon: funnel.icon,
        order: funnel.order,
        stages: {
          create: funnel.stages.map(s => ({
            code: s.code,
            label: s.label,
            color: s.color,
            order: s.order,
            isTransition: (s as any).isTransition || false
          }))
        }
      }
    })
  }
}
import { ownerConfiguration } from '../middleware/action-permissions.js'
