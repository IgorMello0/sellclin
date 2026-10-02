import { integrationHttpClient } from './integration-http.js'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../prisma.js'
import { getJwtSecret } from '../config/security.js'
import { verifyIntegrationState, assertIntegrationOwner } from './integration-state.js'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email'
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

function getPublicAppUrl() {
  return (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || 'https://sellclin.com').replace(/\/+$/, '')
}

function getRedirectUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${getPublicAppUrl()}/api/google-calendar/callback`
}

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar OAuth nao configurado')
  }

  return new OAuth2Client(clientId, clientSecret, getRedirectUri())
}

export function createGoogleCalendarAuthUrl(companyId: number, userId: number, userType: string) {
  const client = getOAuthClient()
  if (userType !== 'profissional') throw new Error('Somente o proprietário pode conectar Google Calendar')
  const state = jwt.sign({ companyId, userId, userType, purpose: 'google-calendar' }, getJwtSecret(), { expiresIn: '15m' })

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [CALENDAR_SCOPE, EMAIL_SCOPE],
    state,
  })
}

export async function handleGoogleCalendarCallback(code: string, stateToken: string) {
  const state = verifyIntegrationState(stateToken, 'google-calendar')
  await assertIntegrationOwner(state.companyId, state.userId)

  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  let googleEmail: string | null = null
  try {
    const accessToken = tokens.access_token
    if (accessToken) {
      const userInfoRes = await integrationHttpClient.fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json() as { email?: string }
        googleEmail = userInfo.email || null
      }
    }
  } catch (error) {
    console.warn('[GoogleCalendar] Nao foi possivel obter e-mail conectado:', error)
  }

  const current = await prisma.googleCalendarConnection.findUnique({
    where: { companyId: state.companyId },
  })

  const refreshToken = tokens.refresh_token || current?.refreshToken || null
  if (!refreshToken) {
    throw new Error('Google nao retornou refresh token. Remova o acesso no Google e conecte novamente.')
  }

  await prisma.googleCalendarConnection.upsert({
    where: { companyId: state.companyId },
    update: {
      googleEmail,
      calendarId: 'primary',
      accessToken: tokens.access_token || current?.accessToken || null,
      refreshToken,
      scope: tokens.scope || current?.scope || null,
      tokenType: tokens.token_type || current?.tokenType || null,
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : current?.expiryDate || null,
      status: 'connected',
      lastError: null,
    },
    create: {
      companyId: state.companyId,
      googleEmail,
      calendarId: 'primary',
      accessToken: tokens.access_token || null,
      refreshToken,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || null,
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
      status: 'connected',
    },
  })

  const initialSync = await resyncCompanyAppointments(state.companyId)
  console.info('[GoogleCalendar] Sincronizacao inicial concluida', {
    companyId: state.companyId,
    ...initialSync,
  })

  return { companyId: state.companyId, googleEmail, initialSync }
}

async function getConnection(companyId?: number | null) {
  if (!companyId) return null
  return prisma.googleCalendarConnection.findUnique({ where: { companyId } })
}

async function getAuthorizedAccessToken(connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>) {
  const client = getOAuthClient()
  client.setCredentials({
    access_token: connection.accessToken || undefined,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.expiryDate ? Number(connection.expiryDate) : undefined,
    token_type: connection.tokenType || undefined,
    scope: connection.scope || undefined,
  })

  const accessToken = await client.getAccessToken()
  const credentials = client.credentials

  if (credentials.access_token && credentials.access_token !== connection.accessToken) {
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date ? BigInt(credentials.expiry_date) : connection.expiryDate,
        tokenType: credentials.token_type || connection.tokenType,
        scope: credentials.scope || connection.scope,
      },
    })
  }

  if (!accessToken.token) {
    throw new Error('Nao foi possivel renovar o acesso ao Google Calendar')
  }

  return accessToken.token
}

async function googleCalendarRequest(
  connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>,
  path: string,
  init: RequestInit = {}
) {
  const token = await getAuthorizedAccessToken(connection)
  const response = await integrationHttpClient.fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Erro Google Calendar HTTP ${response.status}`
    throw new Error(message)
  }

  return data
}

function buildCalendarEvent(appointment: any) {
  const clientName = appointment.client?.name || appointment.lead?.name || 'Paciente sem nome'
  const serviceName = appointment.service?.name || 'Consulta'
  const professionalName = appointment.professional?.name || 'Profissional'
  const notes = appointment.notes ? `\n\nObservacoes:\n${appointment.notes}` : ''

  return {
    summary: `${clientName} - ${serviceName}`,
    description: `Agendamento criado pelo SellClin.\nProfissional: ${professionalName}${notes}`,
    start: {
      dateTime: new Date(appointment.startTime).toISOString(),
      timeZone: DEFAULT_TIME_ZONE,
    },
    end: {
      dateTime: new Date(appointment.endTime).toISOString(),
      timeZone: DEFAULT_TIME_ZONE,
    },
    extendedProperties: {
      private: {
        salesclinAppointmentId: String(appointment.id),
        salesclinCompanyId: appointment.companyId ? String(appointment.companyId) : '',
      },
    },
  }
}

function getGoogleErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar Google Calendar'
}

export async function syncAppointmentToGoogle(appointmentId: number) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true, lead: true, service: true, professional: true },
  })

  if (!appointment?.companyId) return null

  const connection = await getConnection(appointment.companyId)
  if (!connection || connection.status !== 'connected') {
    return null
  }

  try {
    if (appointment.status === 'cancelado') {
      await deleteAppointmentFromGoogle(appointmentId)
      return null
    }

    const event = buildCalendarEvent(appointment)
    const calendarId = encodeURIComponent(connection.calendarId || 'primary')

    let googleEvent: any
    if (appointment.googleEventId) {
      googleEvent = await googleCalendarRequest(
        connection,
        `/calendars/${calendarId}/events/${encodeURIComponent(appointment.googleEventId)}`,
        { method: 'PATCH', body: JSON.stringify(event) }
      )
    } else {
      googleEvent = await googleCalendarRequest(
        connection,
        `/calendars/${calendarId}/events`,
        { method: 'POST', body: JSON.stringify(event) }
      )
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        googleEventId: googleEvent?.id || appointment.googleEventId,
        googleCalendarId: connection.calendarId || 'primary',
        googleSyncStatus: 'synced',
        googleSyncError: null,
      },
    })

    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastError: null, status: 'connected' },
    })

    return updated
  } catch (error) {
    const message = getGoogleErrorMessage(error)
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleSyncStatus: 'error', googleSyncError: message },
    })
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { lastError: message, status: 'error' },
    })
    return null
  }
}

export async function deleteAppointmentFromGoogle(appointmentId: number) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
  if (!appointment?.companyId || !appointment.googleEventId) return null

  const connection = await getConnection(appointment.companyId)
  if (!connection || !connection.refreshToken) return null

  try {
    const calendarId = encodeURIComponent(appointment.googleCalendarId || connection.calendarId || 'primary')
    await googleCalendarRequest(
      connection,
      `/calendars/${calendarId}/events/${encodeURIComponent(appointment.googleEventId)}`,
      { method: 'DELETE' }
    )
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleSyncStatus: 'deleted', googleSyncError: null },
    })
    return true
  } catch (error) {
    const message = getGoogleErrorMessage(error)
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleSyncStatus: 'error', googleSyncError: message },
    })
    return false
  }
}

export async function resyncCompanyAppointments(companyId: number) {
  const appointments = await prisma.appointment.findMany({
    where: {
      companyId,
      status: { not: 'cancelado' },
    },
    select: { id: true },
    orderBy: { startTime: 'asc' },
  })

  let synced = 0
  let failed = 0

  for (const appointment of appointments) {
    const result = await syncAppointmentToGoogle(appointment.id)
    if (result) synced += 1
    else failed += 1
  }

  return { total: appointments.length, synced, failed }
}
