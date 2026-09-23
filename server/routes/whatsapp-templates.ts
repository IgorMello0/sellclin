import { Router } from 'express'
import { auth, requireCompanyOwner, requireModule } from '../middleware/auth.js'
import { prisma } from '../prisma.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import {
  createMetaTemplate,
  deleteMetaTemplate,
  listWhatsAppTemplates,
  syncMetaTemplates,
  getMetaTemplateAccount,
  resubmitMetaTemplate,
} from '../services/whatsapp-templates.js'

export const router = Router()

async function getRequestCompanyId(req: any) {
  if (req.user?.companyId) return Number(req.user.companyId)
  if (req.user?.type === 'profissional') {
    const professional = await prisma.professional.findUnique({
      where: { id: req.user.id },
      select: { companyId: true },
    })
    return professional?.companyId || null
  }
  return null
}

router.get('/', auth(), requireModule('conversas'), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    if (req.query.refresh === 'true') {
      if (req.user?.type !== 'profissional') {
        return res.status(403).json(createErrorResponse('Apenas o proprietario pode sincronizar templates', 403))
      }
      const ownedCompany = await prisma.empresa.findFirst({
        where: { id: companyId, ownerId: req.user.id },
        select: { id: true },
      })
      if (!ownedCompany) {
        return res.status(403).json(createErrorResponse('Apenas o proprietario pode sincronizar templates', 403))
      }
      await syncMetaTemplates(companyId)
    }
    const templates = await listWhatsAppTemplates(companyId, String(req.query.status || ''))
    const account = await getMetaTemplateAccount(companyId).catch(() => null)
    return res.json({ ...createSuccessResponse(templates), templateAccount: account })
  } catch (error: any) {
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao listar templates', 500))
  }
})

router.post('/sync', auth(), requireModule('conversas'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const templates = await syncMetaTemplates(companyId)
    const account = await getMetaTemplateAccount(companyId)
    return res.json({ ...createSuccessResponse(templates), templateAccount: account })
  } catch (error: any) {
    console.error('[WhatsApp Templates] Erro ao sincronizar:', error)
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao sincronizar templates', 400))
  }
})

router.post('/appointment-reminder', auth(), requireModule('conversas'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const template = await createMetaTemplate(companyId, {
      name: 'lembrete_de_agendamento',
      language: 'pt_BR',
      category: 'UTILITY',
      headerText: 'Lembrete de agendamento',
      bodyText: 'Ola, {{1}}. Seu atendimento na {{2}} esta agendado para {{3}}. Responda para confirmar ou solicitar alteracao.',
      bodyExamples: ['Maria', 'Clinica SellClin', '25/07 as 14h'],
      footerText: 'Mensagem referente ao seu agendamento',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'QUICK_REPLY', text: 'Solicitar alteracao' },
      ],
    })
    return res.status(201).json(createSuccessResponse(template))
  } catch (error: any) {
    console.error('[WhatsApp Templates] Erro ao criar lembrete:', error)
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao criar template de lembrete', 400))
  }
})

router.post('/', auth(), requireModule('conversas'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const template = await createMetaTemplate(companyId, req.body || {})
    return res.status(201).json(createSuccessResponse(template))
  } catch (error: any) {
    console.error('[WhatsApp Templates] Erro ao criar:', error)
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao criar template', 400))
  }
})

router.post('/:id/resubmit', auth(), requireModule('conversas'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))
    const templateId = Number(req.params.id)
    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json(createErrorResponse('Template invalido', 400))
    }
    const template = await resubmitMetaTemplate(companyId, templateId)
    return res.json(createSuccessResponse(template))
  } catch (error: any) {
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao reenviar template', 400))
  }
})

router.delete('/:id', auth(), requireModule('conversas'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const templateId = Number(req.params.id)
    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json(createErrorResponse('Template invalido', 400))
    }

    const result = await deleteMetaTemplate(companyId, templateId)
    return res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[WhatsApp Templates] Erro ao excluir:', error)
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao excluir template', 400))
  }
})
