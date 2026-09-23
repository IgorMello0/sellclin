import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import {
  createGoogleCalendarAuthUrl,
  handleGoogleCalendarCallback,
  resyncCompanyAppointments,
} from '../services/google-calendar.js'

export const router = Router()

router.get('/status', auth(), requireModule('agendamentos'), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(400).json(createErrorResponse('Empresa nao definida', 400))

    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { companyId },
      select: {
        googleEmail: true,
        calendarId: true,
        status: true,
        lastSyncAt: true,
        lastError: true,
        updatedAt: true,
      },
    })

    const pendingCount = await prisma.appointment.count({
      where: {
        companyId,
        googleSyncStatus: { in: ['pending', 'error', 'not_synced'] },
      },
    })

    if (!connection) {
      return res.json(createSuccessResponse({
        connected: false,
        status: 'disconnected',
        pendingCount,
      }))
    }

    res.json(createSuccessResponse({
      connected: connection.status === 'connected' || connection.status === 'error',
      ...connection,
      pendingCount,
    }))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message || 'Erro ao consultar Google Calendar', 500))
  }
})

router.get('/connect', auth(), requireModule('agendamentos'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId || !req.user) return res.status(400).json(createErrorResponse('Empresa nao definida', 400))

    const url = createGoogleCalendarAuthUrl(companyId, req.user.id, req.user.type)
    res.json(createSuccessResponse({ url }))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message || 'Erro ao iniciar conexao com Google Calendar', 500))
  }
})

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string }
  const redirectBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || '/'

  if (error) {
    return res.redirect(`${redirectBase.replace(/\/+$/, '')}/integracoes?channel=google-calendar&googleCalendar=error`)
  }

  if (!code || !state) {
    return res.redirect(`${redirectBase.replace(/\/+$/, '')}/integracoes?channel=google-calendar&googleCalendar=missing`)
  }

  try {
    await handleGoogleCalendarCallback(code, state)
    res.redirect(`${redirectBase.replace(/\/+$/, '')}/integracoes?channel=google-calendar&googleCalendar=connected`)
  } catch (err) {
    console.error('[GoogleCalendar] Callback error:', err)
    res.redirect(`${redirectBase.replace(/\/+$/, '')}/integracoes?channel=google-calendar&googleCalendar=error`)
  }
})

router.post('/disconnect', auth(), requireModule('agendamentos'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(400).json(createErrorResponse('Empresa nao definida', 400))

    await prisma.googleCalendarConnection.deleteMany({ where: { companyId } })
    await prisma.appointment.updateMany({
      where: { companyId },
      data: {
        googleEventId: null,
        googleCalendarId: null,
        googleSyncStatus: 'not_synced',
        googleSyncError: null,
      },
    })

    res.json(createSuccessResponse({ disconnected: true }))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message || 'Erro ao desconectar Google Calendar', 500))
  }
})

router.post('/resync', auth(), requireModule('agendamentos'), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(400).json(createErrorResponse('Empresa nao definida', 400))

    const result = await resyncCompanyAppointments(companyId)
    res.json(createSuccessResponse(result))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message || 'Erro ao sincronizar agenda', 500))
  }
})
