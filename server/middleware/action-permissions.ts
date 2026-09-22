import type { Request, Response, NextFunction } from 'express'
import { requirePermission, requireCompanyOwner } from './auth.js'
import { prisma } from '../prisma.js'

export async function hasActionPermission(req: Request, module: string, key: string) {
  let allowed = false
  let status = 200
  const response = { status(code: number) { status = code; return this }, json() { return this } } as unknown as Response
  await requirePermission(module, key)(req, response, () => { allowed = true })
  if (status >= 500) throw new Error('Erro ao verificar permissões')
  return allowed
}

export function actionPermissions(module: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
    const method = req.method
    const path = req.path
    const body = req.body || {}
    const checks: [string, string][] = []
    const check = (key: string, scope = module) => checks.push([scope, key])
    const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    if (module === 'agendamentos' && /^\/\d+\/?$/.test(path) && !await hasActionPermission(req, module, 'verAgendamentosAlheios')) {
      const id = Number(path.split('/')[1])
      const own = req.user!.type === 'usuario'
        ? { OR: [{ sdrId: req.user!.id }, { especialistaId: req.user!.id }, { lead: { sdrId: req.user!.id } }, { lead: { closerId: req.user!.id } }] }
        : { professionalId: req.user!.id }
      if (!await prisma.appointment.findFirst({ where: { id, companyId: req.user!.companyId!, ...own }, select: { id: true } })) {
        res.status(403).json({ success: false, error: { message: 'Sem acesso a este agendamento', code: 403 } })
        return
      }
    }
    if (module === 'agendamentos') {
      if (method === 'POST') check('criarAgendamentos')
      if (method === 'PUT' || method === 'PATCH') {
        check(body.status === 'cancelado' ? 'cancelarAgendamentos' : 'editarAgendamentos')
        if (body.status === 'cancelado' && Object.keys(body).some(key => key !== 'status')) check('editarAgendamentos')
      }
      if (method === 'DELETE') check('cancelarAgendamentos')
    }
    if (module === 'clientes' && write) {
      check(method === 'DELETE' ? 'excluirContatos' : 'editarContatos')
      if (path.endsWith('/proposals')) check('criarPropostas', 'funnel')
      if (path.endsWith('/proposals') && body.status === 'accepted') check('aprovarPropostas', 'funnel')
      if (path.endsWith('/send-to-funnel')) check('moverFases', 'funnel')
    }
    if (module === 'funnel' && write) {
      if (method === 'DELETE' && /^\/(\d+|bulk)\/?$/.test(path)) check('excluirOportunidades')
      if (path.includes('/proposals')) {
        if (path.endsWith('/reopen-sale')) check('aprovarPropostas')
        else {
          check('criarPropostas')
          if (body.status === 'accepted') check('aprovarPropostas')
        }
      }
      if (path.endsWith('/confirm-payment')) check('aprovarPropostas')
      if ((method === 'PUT' || method === 'PATCH') && /^\/\d+\/?$/.test(path)) {
        if (body.status !== undefined) check('moverFases')
        if (['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(body.status) || body.proposalId != null) check('aprovarPropostas')
      }
    }
    if (module === 'tarefas' && write) {
      if (method === 'DELETE') check('excluirTarefas')
      if (body.assignedToId != null || body.assignedToUserId != null) {
        const isUser = body.assigneeType === 'user' || body.assignedToUserId !== undefined
        const id = Number(body.assignedToUserId ?? body.assignedToId)
        if (id !== req.user?.id || isUser !== (req.user?.type === 'usuario')) {
          const existing = ['PUT', 'PATCH'].includes(method) && /^\/\d+\/?$/.test(path) && req.user?.companyId
            ? await prisma.task.findFirst({ where: { id: Number(path.split('/')[1]), companyId: req.user.companyId }, select: { assignedToId: true, assignedToUserId: true } })
            : null
          const unchanged = existing && (isUser ? existing.assignedToUserId === id : existing.assignedToId === id && existing.assignedToUserId == null)
          if (!unchanged) check('atribuirParaOutros')
        }
      }
    }
    if (module === 'metas' && write) check('gerenciarMetas')
    if (module === 'campanhas' && write) check(method === 'DELETE' ? 'excluirCampanhas' : 'criarCampanhas')
    for (const [scope, key] of checks) {
      let allowed = false
      await requirePermission(scope, key)(req, res, () => { allowed = true })
      if (!allowed) return
    }
    next()
    } catch (error) {
      next(error)
    }
  }
}

// Configuration menus are owner-only; team members may still read options used by the funnel.
export function ownerConfiguration(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD') return next()
  return requireCompanyOwner()(req, res, next)
}
