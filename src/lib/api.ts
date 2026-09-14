const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api')

export interface ApiResponse<T> {
  success: boolean
  templateAccount?: { wabaId: string } | null
  data?: T
  error?: {
    message: string
    code?: number
  }
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}

export interface ModulePermission {
  moduleId?: number
  moduleCode: string
  moduleName: string
  moduleIcon?: string
  hasAccess: boolean
  blockedByPlan?: boolean
  planCode?: string
  subscriptionStatus?: string
  canEdit?: boolean
  subPermissions?: Record<string, boolean> | null
}

export interface BillingStatus {
  planCode: string
  billingCycle: 'monthly' | 'yearly'
  status: string
  trialEndsAt: string
  currentPeriodEndsAt?: string | null
  accessSource?: 'trial' | 'abacatepay' | 'manual' | string | null
  manualAccessEndsAt?: string | null
  daysRemaining: number
  modules: Array<{ code: string; name: string; icon?: string | null }>
  abacateSubscriptionId?: string | null
  abacateCheckoutId?: string | null
  checkoutUrl?: string | null
  pendingPlanCode?: string | null
  pendingBillingCycle?: 'monthly' | 'yearly' | null
  planChangeStatus?: string | null
}

export type BillingCycle = 'monthly' | 'yearly'
export type PublicPlanCode = 'start' | 'pro' | 'enterprise'
export type BillingAddonCode = 'extra_clinic' | 'extra_user'

export interface BillingUsage {
  planCode: string
  billingCycle: BillingCycle
  subscriptionStatus: string
  clinics: {
    used: number
    baseLimit: number | null
    extraQuantity: number
    limit: number | null
    canCreate: boolean
  }
  users: {
    companyId: number
    used: number
    baseLimit: number | null
    extraQuantity: number
    limit: number | null
    canCreate: boolean
  }
}

export interface MessageCreditSummary {
  balanceCents: number
  currency: string
  unitCostCents: number
  availableMessages: number
}

export interface SignupCheckoutPayload {
  name: string
  email: string
  password: string
  phone: string
  specialization: string
  companyName?: string
  planCode: PublicPlanCode
  billingCycle: BillingCycle
}

const MOCK_MODE = false

function getMockResponse(endpoint: string, options: RequestInit): ApiResponse<any> {
  const cleanEndpoint = endpoint.split('?')[0]
  let email = 'admin@admin.com'
  try {
    if (options.body) {
      const body = JSON.parse(options.body as string)
      if (body.email) email = body.email
    }
  } catch (e) {}

  // 1. Auth/Login
  if (cleanEndpoint.includes('/profissionais/login') || cleanEndpoint.includes('/usuarios/login')) {
    return {
      success: true,
      data: {
        token: 'mock-jwt-token-xyz',
        professional: {
          id: 1,
          name: 'Profissional Admin',
          email: email,
          phone: '(11) 99999-9999',
          specialization: 'Administração',
          role: email === 'admin@admin.com' ? 'admin' : 'profissional',
          onboardingCompleted: true,
          company: { id: 1, name: 'Clínica SellClin Mock' },
          companies: [{ id: 1, name: 'Clínica SellClin Mock', role: 'admin' }]
        }
      }
    }
  }

  if (cleanEndpoint.includes('/auth/google')) {
    return {
      success: true,
      data: {
        token: 'mock-jwt-token-xyz',
        professional: {
          id: 1,
          name: 'Profissional Admin (Google)',
          email: 'admin@admin.com',
          phone: '(11) 99999-9999',
          specialization: 'Administração',
          role: 'admin',
          onboardingCompleted: true,
          company: { id: 1, name: 'Clínica SellClin Mock' },
          companies: [{ id: 1, name: 'Clínica SellClin Mock', role: 'admin' }]
        }
      }
    }
  }

  // 2. Permissions
  if (cleanEndpoint === '/permissions/my-permissions') {
    return {
      success: true,
      data: [
        { moduleCode: 'dashboard', moduleName: 'Dashboard', hasAccess: true },
        { moduleCode: 'agendamentos', moduleName: 'Agendamentos', hasAccess: true },
        { moduleCode: 'clientes', moduleName: 'Clientes', hasAccess: true },
        { moduleCode: 'relatorios', moduleName: 'Relatórios', hasAccess: true },
        { moduleCode: 'pagamentos', moduleName: 'Pagamentos', hasAccess: true },
        { moduleCode: 'conversas', moduleName: 'Conversas', hasAccess: true },
        { moduleCode: 'catalogos', moduleName: 'Catálogos', hasAccess: true },
        { moduleCode: 'contratos', moduleName: 'Contratos', hasAccess: true },
        { moduleCode: 'funnel', moduleName: 'Funil de Vendas', hasAccess: true },
        { moduleCode: 'metas', moduleName: 'Metas', hasAccess: true },
        { moduleCode: 'tarefas', moduleName: 'Tarefas', hasAccess: true },
        { moduleCode: 'campanhas', moduleName: 'Campanhas', hasAccess: true }
      ]
    }
  }

  // 3. Me
  if (cleanEndpoint === '/profissionais/me') {
    return {
      success: true,
      data: {
        id: 1,
        name: 'Profissional Admin',
        email: 'admin@admin.com',
        phone: '(11) 99999-9999',
        specialization: 'Administração',
        role: 'admin',
        onboardingCompleted: true,
        company: { id: 1, name: 'Clínica SellClin Mock' },
        companies: [{ id: 1, name: 'Clínica SellClin Mock', role: 'admin' }]
      }
    }
  }

  // 4. Companies
  if (cleanEndpoint === '/empresas/my-company') {
    return {
      success: true,
      data: {
        id: 1,
        name: 'Clínica SellClin Mock',
        logoUrl: null,
        domain: 'sellclin.com',
        isActive: true,
        openHour: '08:00',
        closeHour: '20:00',
        chargeConsultation: false
      }
    }
  }

  if (cleanEndpoint === '/empresas/my-companies') {
    return {
      success: true,
      data: [
        { id: 1, name: 'Clínica SellClin Mock', role: 'admin' }
      ]
    }
  }

  // 5. Dashboard Metrics
  if (cleanEndpoint === '/dashboard/metrics') {
    return {
      success: true,
      data: {
        leads: 142,
        agendamentos: 88,
        comparada: 64,
        oportunidades: 35,
        contratos: 24,
        faturamento: 45000,
        receita: 36000,
        ticketOrcado: 1285,
        ticketFechado: 1500,
        conversao: 16.9,
        conversaoPropostas: 68.5,
        conversaoFinanceira: 80.0,
        parcelamentoMedioBoleto: 3.5,
        metodos: {
          boleto: { gerados: 15000, pagos: 10000 },
          cartao: 12000,
          pix: 11000,
          dinheiro: 3000
        },
        funil: {
          novos: 45,
          contatados: 35,
          agendamentos: 24,
          fechados: 12
        },
        origem: [
          { origin: 'Instagram Ad', count: 68 },
          { origin: 'Google Search', count: 42 },
          { origin: 'Facebook Ad', count: 32 }
        ]
      }
    }
  }

  // 6. Clients
  if (cleanEndpoint.startsWith('/clientes')) {
    return {
      success: true,
      data: [
        { id: 1, name: 'Ana Souza', email: 'ana@gmail.com', phone: '(11) 98888-8888', document: '123.456.789-00', tags: ['vip'], originLead: null },
        { id: 2, name: 'Carlos Silva', email: 'carlos@gmail.com', phone: '(11) 97777-7777', document: '987.654.321-00', tags: ['leads'], originLead: null }
      ]
    }
  }

  // 7. Agendamentos
  if (cleanEndpoint.startsWith('/agendamentos')) {
    return {
      success: true,
      data: [
        {
          id: 1,
          clientId: 1,
          professionalId: 1,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          status: 'agendado',
          client: { id: 1, name: 'Ana Souza' }
        }
      ]
    }
  }

  // 8. Catalogo / Serviços
  if (cleanEndpoint.startsWith('/catalogo')) {
    return {
      success: true,
      data: [
        { id: 1, name: 'Consulta Geral', price: 150.0, durationMinutes: 60, status: 'ativo' },
        { id: 2, name: 'Tratamento Especial', price: 500.0, durationMinutes: 90, status: 'ativo' }
      ]
    }
  }

  // 9. Tasks
  if (cleanEndpoint.startsWith('/tasks')) {
    return {
      success: true,
      data: [
        { id: 1, title: 'Retornar para Lead Ana', priority: 'high', status: 'pending', dueDate: new Date().toISOString() }
      ]
    }
  }

  // 10. Notifications
  if (cleanEndpoint.startsWith('/notifications')) {
    return {
      success: true,
      data: [
        { id: 1, title: 'Novo agendamento', content: 'Ana Souza agendou para hoje às 14:00', read: false }
      ]
    }
  }

  // 11. Roles
  if (cleanEndpoint.startsWith('/roles')) {
    return {
      success: true,
      data: [
        { id: 1, name: 'Administrador', value: 'admin' },
        { id: 2, name: 'Comercial', value: 'comercial' }
      ]
    }
  }

  // 12. Metas
  if (cleanEndpoint.startsWith('/metas')) {
    return {
      success: true,
      data: []
    }
  }

  // 12.1. Leads (All)
  if (cleanEndpoint.startsWith('/leads')) {
    if (cleanEndpoint.includes('/proposals')) {
      return {
        success: true,
        data: []
      }
    }
    return {
      success: true,
      data: [
        {
          id: 1,
          name: 'Ana Souza',
          value: 1500,
          origin: 'instagram',
          status: 'prospect_lead',
          phone: '(11) 98888-8888',
          email: 'ana@gmail.com',
          isScheduled: false,
          isPaid: false,
          notes: 'Interessada no tratamento facial.',
          responsible: 'Amanda Santos',
          tags: ['Estética'],
          activities: []
        },
        {
          id: 2,
          name: 'Carlos Silva',
          value: 3200,
          origin: 'meta ads',
          status: 'prospect_qualified',
          phone: '(11) 97777-7777',
          email: 'carlos@gmail.com',
          isScheduled: true,
          isPaid: false,
          notes: 'Qualificado. Procura implante dentário.',
          responsible: 'Amanda Santos',
          tags: ['Implantodontia'],
          activities: []
        },
        {
          id: 3,
          name: 'Juliana Costa',
          value: 2500,
          origin: 'google',
          status: 'prospect_scheduled',
          phone: '(11) 96666-6666',
          email: 'juliana@gmail.com',
          isScheduled: true,
          isPaid: false,
          notes: 'Agendou consulta de avaliação.',
          responsible: 'Amanda Santos',
          tags: ['Clínico Geral'],
          activities: []
        },
        {
          id: 4,
          name: 'Lucas Santos',
          value: 5000,
          origin: 'indicação',
          status: 'comercial_proposal',
          phone: '(11) 95555-5555',
          email: 'lucas@gmail.com',
          isScheduled: true,
          isPaid: false,
          notes: 'Aguardando aprovação da proposta.',
          responsible: 'Amanda Santos',
          tags: ['Ortodontia'],
          activities: []
        },
        {
          id: 5,
          name: 'Maria Oliveira',
          value: 1800,
          origin: 'whatsapp',
          status: 'comercial_consult',
          phone: '(11) 94444-4444',
          email: 'maria@gmail.com',
          isScheduled: true,
          isPaid: false,
          notes: 'Realizou a consulta inicial.',
          responsible: 'Amanda Santos',
          tags: ['Estética'],
          activities: []
        }
      ]
    }
  }

  // 13. Funnel Config
  if (cleanEndpoint.startsWith('/funnel-config')) {
    return {
      success: true,
      data: [
        {
          id: 1,
          code: 'prospecting',
          label: 'Prospecção',
          icon: 'person_search',
          order: 0,
          stages: [
            { id: 1, code: 'prospect_lead', label: 'Novos Leads', color: 'bg-blue-500', order: 0 },
            { id: 2, code: 'prospect_qualified', label: 'Qualificados', color: 'bg-indigo-500', order: 1 },
            { id: 3, code: 'prospect_scheduled', label: 'Agendados', color: 'bg-violet-500', order: 2 },
            { id: 4, code: 'prospect_attended', label: 'Compareceu', color: 'bg-emerald-500', isTransition: true, order: 3 }
          ]
        },
        {
          id: 2,
          code: 'commercial',
          label: 'Comercial',
          icon: 'handshake',
          order: 1,
          stages: [
            { id: 5, code: 'comercial_consult', label: 'Consulta Feita', color: 'bg-emerald-500', isLinked: true, order: 0 },
            { id: 6, code: 'comercial_proposal', label: 'Proposta', color: 'bg-orange-500', order: 1 },
            { id: 7, code: 'comercial_follow', label: 'Follow-up', color: 'bg-amber-500', order: 2 },
            { id: 8, code: 'comercial_closed', label: 'Fechado', color: 'bg-green-600', order: 3 }
          ]
        },
        {
          id: 3,
          code: 'sales',
          label: 'Vendas',
          icon: 'payments',
          order: 2,
          stages: [
            { id: 9, code: 'sales_payment', label: 'Pagamento', color: 'bg-cyan-500', order: 0 },
            { id: 10, code: 'sales_contract', label: 'Contrato', color: 'bg-blue-600', order: 1 },
            { id: 11, code: 'sales_post', label: 'Pós-Venda', color: 'bg-purple-500', order: 2 }
          ]
        }
      ]
    }
  }

  // 14. Billing
  if (cleanEndpoint.startsWith('/billing/status')) {
    return {
      success: true,
      data: {
        planCode: 'pro',
        billingCycle: 'monthly',
        status: 'active',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
        daysRemaining: 30,
        modules: []
      }
    }
  }

  if (cleanEndpoint.startsWith('/billing/usage')) {
    return {
      success: true,
      data: {
        planCode: 'pro',
        billingCycle: 'monthly',
        subscriptionStatus: 'active',
        clinics: { used: 1, baseLimit: 5, extraQuantity: 0, limit: 5, canCreate: true },
        users: { companyId: 1, used: 2, baseLimit: 10, extraQuantity: 0, limit: 10, canCreate: true }
      }
    }
  }

  return {
    success: true,
    data: null
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  if (MOCK_MODE) {
    console.warn(`[API] [MOCK MODE] Intercepted request to ${endpoint}`)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockResponse(endpoint, options) as ApiResponse<T>)
      }, 200)
    })
  }

  const url = `${API_BASE_URL}${endpoint}`
  const token = localStorage.getItem('token')
  const activeCompanyId = localStorage.getItem('activeCompanyId')

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(activeCompanyId && { 'X-Company-Id': activeCompanyId }),
    ...options.headers,
  }

  try {
    if (import.meta.env.DEV) console.log('[API] Request:', { url, method: options.method || 'GET', body: options.body })

    const method = String(options.method || 'GET').toUpperCase()
    const maxAttempts = method === 'GET' ? 2 : 1
    let response: Response | null = null
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await fetch(url, { ...options, headers })
        if (attempt < maxAttempts && [502, 503, 504].includes(response.status)) {
          await new Promise(resolve => setTimeout(resolve, 350))
          continue
        }
        break
      } catch (error) {
        lastError = error
        if (attempt >= maxAttempts) throw error
        await new Promise(resolve => setTimeout(resolve, 350))
      }
    }
    if (!response) throw lastError || new Error('Falha de conexao')

    if (import.meta.env.DEV) console.log('[API] Response:', { status: response.status, statusText: response.statusText, url })

    let data
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = text ? { message: text } : { message: 'Erro na requisição' }
    }
    
    if (import.meta.env.DEV) console.log('[API] Response data:', data)
    
    if (!response.ok) {
      // Se for erro de autenticação (401), limpar token e redirecionar para login
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('professional')
        const publicAuthPaths = ['/login', '/signup', '/accept-invite', '/verify-email', '/forgot-password', '/reset-password']
        // Redirecionar para login apenas fora das telas publicas de autenticação.
        if (!publicAuthPaths.includes(window.location.pathname)) {
          window.location.href = '/login'
        }
      }
      
      return {
        success: false,
        error: data.error || { message: data.message || 'Erro na requisição', code: response.status },
      }
    }

    return data
  } catch (error) {
    console.error('[API] Error:', error)
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Erro de conexão. Verifique se o servidor está rodando.',
        code: 0,
      },
    }
  }
}

// Clientes
export const clientsApi = {
  getAll: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.search) query.append('search', params.search)
    
    return apiRequest<Array<any>>(`/clientes?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/clientes/${id}`),
  getDossier: async (id: number) => apiRequest<any>(`/clientes/${id}/dossier`),
  addProposal: async (id: number, data: any) => apiRequest<any>(`/clientes/${id}/proposals`, { method: 'POST', body: JSON.stringify(data) }),
  sendToFunnel: async (id: number) => apiRequest<any>(`/clientes/${id}/send-to-funnel`, { method: 'POST' }),
  create: async (data: any) => apiRequest<any>('/clientes', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/clientes/${id}`, { method: 'DELETE' }),
}

// Dashboard
export const dashboardApi = {
  getMetrics: async (filter: string = 'custom', startDate?: string, endDate?: string, sdrId?: string, closerId?: string) => {
    const query = new URLSearchParams({ filter })
    if (startDate) query.append('startDate', startDate)
    if (endDate) query.append('endDate', endDate)
    if (sdrId && sdrId !== 'all') query.append('sdrId', sdrId)
    if (closerId && closerId !== 'all') query.append('closerId', closerId)
    return apiRequest<any>(`/dashboard/metrics?${query.toString()}`)
  },
}

// Auth (Google OAuth)
export const authApi = {
  loginWithGoogle: async (credential: string) =>
    apiRequest<{ token: string; professional: any }>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  resendVerification: async (email: string) =>
    apiRequest<{ sent?: boolean; alreadyVerified?: boolean }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmail: async (token: string) =>
    apiRequest<{ verified: boolean }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  acceptTeamInvite: async (token: string, password: string) =>
    apiRequest<{ accepted: boolean }>('/auth/team-invite/accept', { method: 'POST', body: JSON.stringify({ token, password }) }),
  forgotPassword: async (email: string) =>
    apiRequest<{ sent: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: async (token: string, password: string) =>
    apiRequest<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  changePassword: async (currentPassword: string, newPassword: string) =>
    apiRequest<{ updated: boolean }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
}

// Profissionais
export const professionalsApi = {
  login: async (email: string, password: string) => 
    apiRequest<{ token: string; professional: any }>('/profissionais/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: async (data: { name: string; email: string; password: string; phone?: string; specialization?: string }) => 
    apiRequest<{ token?: string; professional: any; requiresEmailVerification?: boolean; email?: string }>('/profissionais', { method: 'POST', body: JSON.stringify(data) }),
  completeOnboarding: async (data: any) => apiRequest<any>('/profissionais/onboarding/complete', { method: 'POST', body: JSON.stringify(data) }),
  getMe: async () => apiRequest<any>('/profissionais/me'),
  updateMe: async (data: any) => apiRequest<any>('/profissionais/me', { method: 'PUT', body: JSON.stringify(data) }),
  getAll: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.search) query.append('search', params.search)
    
    return apiRequest<Array<any>>(`/profissionais?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/profissionais/${id}`),
  getClients: async (id: number, params?: { page?: number; pageSize?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    
    return apiRequest<Array<any>>(`/profissionais/${id}/clientes?${query.toString()}`)
  },
  create: async (data: any) => apiRequest<any>('/profissionais', { method: 'POST', body: JSON.stringify(data) }),
  addTeamMember: async (data: any) => apiRequest<any>('/profissionais/equipe', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/profissionais/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/profissionais/${id}`, { method: 'DELETE' }),
}

// Categorias
export const categoriesApi = {
  getAll: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.search) query.append('search', params.search)
    
    return apiRequest<Array<any>>(`/categorias?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/categorias/${id}`),
  create: async (data: any) => apiRequest<any>('/categorias', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/categorias/${id}`, { method: 'DELETE' }),
}

// Usuários
export const usuariosApi = {
  getAll: async (params?: { page?: number; pageSize?: number; search?: string; allCompanies?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.allCompanies) query.append('allCompanies', 'true')
    
    return apiRequest<Array<any>>(`/usuarios?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/usuarios/${id}`),
  login: async (email: string, password: string) => 
    apiRequest<{ token: string }>('/usuarios/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  completeOnboarding: async (data: any) => apiRequest<any>('/usuarios/onboarding/complete', { method: 'POST', body: JSON.stringify(data) }),
  create: async (data: any) => apiRequest<any>('/usuarios', { method: 'POST', body: JSON.stringify(data) }),
  resendInvite: async (id: number) => apiRequest<{ sent: boolean }>(`/usuarios/${id}/resend-invite`, { method: 'POST' }),
  update: async (id: number, data: any) => apiRequest<any>(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/usuarios/${id}`, { method: 'DELETE' }),
}

// Agendamentos
export const appointmentsApi = {
  getAll: async (params?: { page?: number; pageSize?: number; professionalId?: number; clientId?: number; status?: string }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.professionalId) query.append('professionalId', params.professionalId.toString())
    if (params?.clientId) query.append('clientId', params.clientId.toString())
    if (params?.status) query.append('status', params.status)
    
    return apiRequest<Array<any>>(`/agendamentos?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/agendamentos/${id}`),
  create: async (data: any) => apiRequest<any>('/agendamentos', { method: 'POST', body: JSON.stringify(data) }),
  checkAvailability: async (professionalId: string, startTime: string, endTime: string) => {
    const query = new URLSearchParams({ professionalId, startTime, endTime })
    return apiRequest<any>(`/agendamentos/check-availability?${query.toString()}`)
  },
  getAvailableSlots: async (professionalId: string, date: string, durationMinutes: number, isUsuario?: boolean) => {
    const query = new URLSearchParams({ professionalId, date, durationMinutes: durationMinutes.toString() })
    if (isUsuario) {
      query.append('isUsuario', 'true')
    }
    return apiRequest<string[]>(`/agendamentos/available-slots?${query.toString()}`)
  },
  update: async (id: number, data: any) => apiRequest<any>(`/agendamentos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/agendamentos/${id}`, { method: 'DELETE' }),
}

// Leads
export const leadsApi = {
  getAll: async (params?: { page?: number; pageSize?: number; search?: string; status?: string; professionalId?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.status) query.append('status', params.status)
    if (params?.professionalId) query.append('professionalId', params.professionalId.toString())
    
    return apiRequest<Array<any>>(`/leads?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/leads/${id}`),
  create: async (data: any) => apiRequest<any>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/leads/${id}`, { method: 'DELETE' }),
  addActivity: async (id: number, data: any) => apiRequest<any>(`/leads/${id}/activities`, { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: async (id: number, activityId: number, data: any) => apiRequest<any>(`/leads/${id}/activities/${activityId}`, { method: 'PUT', body: JSON.stringify(data) }),
  addProposal: async (id: number, data: any) => apiRequest<any>(`/leads/${id}/proposals`, { method: 'POST', body: JSON.stringify(data) }),
  getProposals: async (id: number) => apiRequest<Array<any>>(`/leads/${id}/proposals`),
  updateProposal: async (id: number, proposalId: number, data: any) => apiRequest<any>(`/leads/${id}/proposals/${proposalId}`, { method: 'PUT', body: JSON.stringify(data) }),
  confirmPayment: async (id: number, data: any) => apiRequest<any>(`/leads/${id}/confirm-payment`, { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: async (id: number, data: { sdrId?: number | null, closerId?: number | null, especialistaId?: number | null }) => apiRequest<any>(`/leads/${id}/assignment`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkDelete: async (ids: number[]) => apiRequest<any>('/leads/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  bulkAssignment: async (ids: number[], data: { sdrId?: number | null, closerId?: number | null, especialistaId?: number | null }) => apiRequest<any>('/leads/bulk-assignment', { method: 'PATCH', body: JSON.stringify({ ids, ...data }) }),
  importLeads: async (data: { leads: any[], defaultSdrId?: number, defaultCloserId?: number, defaultStage?: string }) => apiRequest<any>('/leads/import', { method: 'POST', body: JSON.stringify(data) }),
}


// Catálogos
export const catalogsApi = {
  getAll: async (params?: { page?: number; pageSize?: number; search?: string; professionalId?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.professionalId) query.append('professionalId', params.professionalId.toString())
    
    return apiRequest<Array<any>>(`/catalogo?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/catalogo/${id}`),
  create: async (data: any) => apiRequest<any>('/catalogo', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/catalogo/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/catalogo/${id}`, { method: 'DELETE' }),
}

// Módulos do sistema
export const modulesApi = {
  getAll: async () => apiRequest<Array<any>>('/modules'),
  getByCode: async (code: string) => apiRequest<any>(`/modules/${code}`),
  create: async (data: any) => apiRequest<any>('/modules', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/modules/${id}`, { method: 'DELETE' }),
}

// Permissões
export const permissionsApi = {
  // Permissões de profissionais
  getProfessionalPermissions: async (professionalId: number) => 
    apiRequest<Array<ModulePermission>>(`/permissions/professional/${professionalId}`),
  updateProfessionalPermissions: async (professionalId: number, permissions: Array<{ moduleId: number; hasAccess: boolean }>) => 
    apiRequest<any>(`/permissions/professional/${professionalId}`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  
  // Permissões de usuários
  getUserPermissions: async (userId: number) => 
    apiRequest<Array<ModulePermission>>(`/permissions/user/${userId}`),
  updateUserPermissions: async (userId: number, permissions: Array<{ moduleId: number; hasAccess: boolean }>) => 
    apiRequest<any>(`/permissions/user/${userId}`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  
  // Minhas permissões (usuário logado)
  getMyPermissions: async () => 
    apiRequest<Array<ModulePermission>>('/permissions/my-permissions'),
}

export const billingApi = {
  getStatus: async () => apiRequest<BillingStatus>('/billing/status'),
  getUsage: async (companyId?: number) => apiRequest<BillingUsage>(
    `/billing/usage${companyId ? `?companyId=${companyId}` : ''}`,
  ),
  getMessageCredits: async () => apiRequest<MessageCreditSummary>('/billing/message-credits'),
  selectPlan: async (planCode: string, billingCycle: BillingCycle = 'monthly') =>
    apiRequest<{ planCode: string; billingCycle: string; status: string }>('/billing/select-plan', {
      method: 'POST',
      body: JSON.stringify({ planCode, billingCycle }),
    }),
  createCheckout: async (planCode?: string, billingCycle?: BillingCycle) =>
    apiRequest<{ checkoutId?: string | null; checkoutUrl: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planCode, billingCycle }),
    }),
  changePlan: async (planCode: string, billingCycle: BillingCycle) =>
    apiRequest<{
      planCode: string
      billingCycle: string
      pendingPlanCode?: string | null
      pendingBillingCycle?: string | null
      planChangeStatus?: string | null
    }>('/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ planCode, billingCycle }),
    }),
  cancelSubscription: async () =>
    apiRequest<{ planCode: string; billingCycle: string; status: string; canceledAt?: string | null }>('/billing/cancel-subscription', {
      method: 'POST',
    }),
  createSignupCheckout: async (payload: SignupCheckoutPayload) =>
    apiRequest<{ pendingSignupId: number; checkoutId?: string | null; checkoutUrl: string }>('/billing/signup-checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createAddonCheckout: async (payload: {
    addonCode: BillingAddonCode
    targetCompanyId?: number | null
    billingCycle?: BillingCycle
    quantity?: number
  }) =>
    apiRequest<{ billingAddonId: number; checkoutId?: string | null; checkoutUrl: string }>('/billing/addon-checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelTrial: async () => apiRequest<{ planCode: string; status: string; canceledAt?: string | null }>('/billing/cancel-trial', {
    method: 'POST',
  }),
}

// -- Módulo de Empresas movido para o final do arquivo --
// Metas
export const goalsApi = {
  list: async (professionalId?: number) => apiRequest<any[]>(`/metas?professionalId=${professionalId || ''}`),
  create: async (data: any) => apiRequest<any>('/metas', { method: 'POST', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<any>(`/metas/${id}`, { method: 'DELETE' }),
}

// Cargos
export const rolesApi = {
  getAll: async () => apiRequest<Array<any>>('/roles'),
  getById: async (id: number) => apiRequest<any>(`/roles/${id}`),
  create: async (data: { name: string; value: string; permissions?: any[] }) => apiRequest<any>('/roles', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: { name: string; permissions: any[] }) => apiRequest<any>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<any>(`/roles/${id}`, { method: 'DELETE' }),
}

// Empresas (Clínicas)
export const empresasApi = {
  getMyCompany: async () => apiRequest<any>('/empresas/my-company'),
  myCompanies: async () => apiRequest<Array<any>>('/empresas/my-companies'),
  myCompany: async () => apiRequest<any>('/empresas/my-company'),
  getAll: async (params?: { page?: number; pageSize?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    return apiRequest<Array<any>>(`/empresas?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/empresas/${id}`),
  create: async (data: any) => apiRequest<any>('/empresas', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/empresas/${id}`, { method: 'DELETE' }),
  startWhatsappConnection: async () => apiRequest<any>('/empresas/my-company/whatsapp/connect/start', { method: 'POST' }),
  startWhatsappPairingCode: async (phone: string) => apiRequest<any>('/empresas/my-company/whatsapp/connect/pairing-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),
  getWhatsappStatus: async () => apiRequest<any>('/empresas/my-company/whatsapp/status'),
  getWhatsappDiagnostics: async () => apiRequest<any>('/empresas/my-company/whatsapp/diagnostics'),
  setupWhatsappWebhook: async () => apiRequest<any>('/empresas/my-company/whatsapp/webhook/setup', { method: 'POST' }),
  disconnectWhatsapp: async () => apiRequest<any>('/empresas/my-company/whatsapp/disconnect', { method: 'POST' }),
  restartWhatsapp: async () => apiRequest<any>('/empresas/my-company/whatsapp/restart', { method: 'POST' }),
}

export const googleCalendarApi = {
  status: async () => apiRequest<any>('/google-calendar/status'),
  connect: async () => apiRequest<{ url: string }>('/google-calendar/connect'),
  disconnect: async () => apiRequest<any>('/google-calendar/disconnect', { method: 'POST' }),
  resync: async () => apiRequest<any>('/google-calendar/resync', { method: 'POST' }),
}

export const whatsappMetaApi = {
  status: async () => apiRequest<any>('/whatsapp/meta/status'),
  connect: async (mode: 'cloud_api' | 'coexistence' = 'coexistence') =>
    apiRequest<{ url: string }>(`/whatsapp/meta/connect?mode=${mode}`),
  configure: async (data: {
    phoneNumberId: string
    wabaId: string
    businessId?: string
    accessToken?: string
    webhookVerifyToken: string
    twoStepPin?: string
    displayPhoneNumber?: string
  }) => apiRequest<any>('/whatsapp/meta/configure', { method: 'POST', body: JSON.stringify(data) }),
  repairWebhook: async (mode?: 'cloud_api' | 'coexistence') => apiRequest<any>('/whatsapp/meta/webhook/repair', {
    method: 'POST',
    body: JSON.stringify(mode ? { mode } : {}),
  }),
  disconnect: async () => apiRequest<any>('/whatsapp/meta/disconnect', { method: 'POST' }),
}

export const whatsappTemplatesApi = {
  list: async (status?: string, refresh = false) => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (refresh) query.set('refresh', 'true')
    return apiRequest<any[]>(`/whatsapp/templates?${query}`)
  },
  sync: async () => apiRequest<any[]>('/whatsapp/templates/sync', { method: 'POST' }),
  resubmit: async (id: number) => apiRequest<any>(`/whatsapp/templates/${id}/resubmit`, { method: 'POST' }),
  create: async (data: import('@/types/whatsapp-template').CreateWhatsAppTemplateInput) =>
    apiRequest<any>('/whatsapp/templates', { method: 'POST', body: JSON.stringify(data) }),
  createAppointmentReminder: async () =>
    apiRequest<any>('/whatsapp/templates/appointment-reminder', { method: 'POST' }),
  delete: async (id: number) => apiRequest<any>(`/whatsapp/templates/${id}`, { method: 'DELETE' }),
}

export const whatsappUazapiApi = {
  status: async () => apiRequest<any>('/whatsapp/uazapi/status'),
  connect: async (phone?: string) => apiRequest<any>('/whatsapp/uazapi/connect', {
    method: 'POST',
    body: JSON.stringify(phone ? { phone } : {}),
  }),
  setupWebhook: async () => apiRequest<any>('/whatsapp/uazapi/webhook/setup', { method: 'POST' }),
  disconnect: async () => apiRequest<any>('/whatsapp/uazapi/disconnect', { method: 'POST' }),
}

export const conversationsApi = {
  list: async (filters?: { status?: string; assignment?: string; labelId?: number; conversion?: 'in_progress' | 'converted'; search?: string }) => {
    const query = new URLSearchParams({ page: '1', pageSize: '100' })
    if (filters?.status) query.set('status', filters.status)
    if (filters?.assignment) query.set('assignment', filters.assignment)
    if (filters?.labelId) query.set('labelId', String(filters.labelId))
    if (filters?.conversion) query.set('conversion', filters.conversion)
    if (filters?.search?.trim()) query.set('search', filters.search.trim())
    return apiRequest<any[]>(`/conversas?${query.toString()}`)
  },
  workspace: async () => apiRequest<any>('/conversas/workspace'),
  getById: async (id: number) => apiRequest<any>(`/conversas/${id}`),
  sendMessage: async (id: number, content: string, media?: { url: string; type: 'image' | 'video' | 'audio' }) => apiRequest<any>(`/conversas/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, mediaUrl: media?.url, mediaType: media?.type }),
  }),
  sendTemplate: async (id: number, data: { templateId: number; parameterValues?: string[]; headerMediaUrl?: string }) =>
    apiRequest<any>(`/conversas/${id}/templates`, { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: { agentId?: number | null }) => apiRequest<any>(`/conversas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  markRead: async (id: number) => apiRequest<any>(`/conversas/${id}/read`, { method: 'POST' }),
  setStatus: async (id: number, status: 'OPEN' | 'PENDING' | 'RESOLVED') =>
    apiRequest<any>(`/conversas/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  assign: async (id: number, data: { assigneeType: 'professional' | 'user' | null; assigneeId?: number | null }) =>
    apiRequest<any>(`/conversas/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  listNotes: async (id: number) => apiRequest<any[]>(`/conversas/${id}/notes`),
  addNote: async (id: number, content: string) =>
    apiRequest<any>(`/conversas/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
  createLabel: async (data: { name: string; color: string }) =>
    apiRequest<any>('/conversas/labels', { method: 'POST', body: JSON.stringify(data) }),
  addLabel: async (id: number, labelId: number) =>
    apiRequest<any>(`/conversas/${id}/labels`, { method: 'POST', body: JSON.stringify({ labelId }) }),
  removeLabel: async (id: number, labelId: number) =>
    apiRequest<any>(`/conversas/${id}/labels/${labelId}`, { method: 'DELETE' }),
}

export const aiAgentsApi = {
  list: async () => apiRequest<any[]>('/agentes-ia?page=1&pageSize=100'),
  create: async (data: { name: string; basePrompt: string; temperature?: number; mode?: string }) =>
    apiRequest<any>('/agentes-ia', { method: 'POST', body: JSON.stringify(data) }),
}

// Configuração de Funis
export const funnelConfigApi = {
  getAll: async () => apiRequest<Array<any>>('/funnel-config'),
  create: async (data: { code: string; label: string; icon?: string; order?: number }) =>
    apiRequest<any>('/funnel-config', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) =>
    apiRequest<any>(`/funnel-config/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) =>
    apiRequest<any>(`/funnel-config/${id}`, { method: 'DELETE' }),
  addStage: async (funnelId: number, data: { code: string; label: string; color?: string; order?: number; isTransition?: boolean }) =>
    apiRequest<any>(`/funnel-config/${funnelId}/stages`, { method: 'POST', body: JSON.stringify(data) }),
  updateStage: async (stageId: number, data: any) =>
    apiRequest<any>(`/funnel-config/stages/${stageId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStage: async (stageId: number) =>
    apiRequest<any>(`/funnel-config/stages/${stageId}`, { method: 'DELETE' }),
  reorder: async (funnels: Array<{ id: number; order: number; stages?: Array<{ id: number; order: number }> }>) =>
    apiRequest<any>('/funnel-config/reorder/batch', { method: 'PUT', body: JSON.stringify({ funnels }) }),
  seedDefaults: async () =>
    apiRequest<any>('/funnel-config/seed', { method: 'POST' }),
}

// Configuração de Status de Leads
export const leadOriginsApi = {
  getAll: async () => apiRequest<Array<any>>('/lead-origins'),
  create: async (data: { label: string }) =>
    apiRequest<any>('/lead-origins', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: { label?: string }) =>
    apiRequest<any>(`/lead-origins/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) =>
    apiRequest<any>(`/lead-origins/${id}`, { method: 'DELETE' }),
}

export const leadStatusesApi = {
  getAll: async () => apiRequest<Array<any>>('/lead-statuses'),
  create: async (data: { label: string; color: string }) =>
    apiRequest<any>('/lead-statuses', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: { label: string; color: string }) =>
    apiRequest<any>(`/lead-statuses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reorder: async (statuses: { id: number; order: number }[]) =>
    apiRequest<any>('/lead-statuses/reorder/all', { method: 'PUT', body: JSON.stringify({ statuses }) }),
  delete: async (id: number) =>
    apiRequest<any>(`/lead-statuses/${id}`, { method: 'DELETE' }),
}

// Upload de Arquivos
export const uploadApi = {
  uploadImage: async (file: File): Promise<ApiResponse<{ url: string }>> => {
    const token = localStorage.getItem('token')
    const activeCompanyId = localStorage.getItem('activeCompanyId')
    const url = `${API_BASE_URL}/upload`
    
    const formData = new FormData()
    formData.append('image', file)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(activeCompanyId && { 'X-Company-Id': activeCompanyId }),
        },
        body: formData
      })
      return await response.json()
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem',
          code: 0
        }
      }
    }
  }
}

// Tarefas (Tasks)
export const tasksApi = {
  getAll: async (params?: { status?: string; priority?: string; dueDateRange?: string; search?: string; team?: boolean | string; leadId?: number; includeCadence?: boolean | string }) => {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    if (params?.priority) query.append('priority', params.priority)
    if (params?.dueDateRange) query.append('dueDateRange', params.dueDateRange)
    if (params?.search) query.append('search', params.search)
    if (params?.team !== undefined) query.append('team', params.team.toString())
    if (params?.leadId) query.append('leadId', params.leadId.toString())
    if (params?.includeCadence !== undefined) query.append('includeCadence', params.includeCadence.toString())
    return apiRequest<Array<any>>(`/tasks?${query.toString()}`)
  },
  create: async (data: any) => apiRequest<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) => apiRequest<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) => apiRequest<{ id: number }>(`/tasks/${id}`, { method: 'DELETE' }),
}

// Notificações (Notifications)
export const notificationsApi = {
  getAll: async () => apiRequest<Array<any>>('/notifications'),
  readAll: async () => apiRequest<any>('/notifications/read-all', { method: 'PUT' }),
  read: async (id: number) => apiRequest<any>(`/notifications/${id}/read`, { method: 'PUT' }),
}

// Resolver URLs de imagens locais/remotas/base64
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return ''
  if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const baseUrl = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? '' : 'http://localhost:4000')
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

// Campanhas de Mensagens em Massa
export const campaignsApi = {
  getAll: async (params?: { page?: number; pageSize?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    return apiRequest<Array<any>>(`/campaigns?${query.toString()}`)
  },
  getById: async (id: number) => apiRequest<any>(`/campaigns/${id}`),
  create: async (data: {
    name: string
    message: string
    audienceType: string
    provider?: 'meta' | 'uazapi'
    connectionMode?: 'cloud_api' | 'coexistence' | 'unofficial'
    templateParameterMappings?: string[]
    audienceFilter?: any
    mediaUrl?: string | null
    mediaType?: string | null
    minDelay?: number
    maxDelay?: number
    randomize?: boolean
    variations?: string[] | null
    templateId?: number | null
  }) =>
    apiRequest<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number, data: any) =>
    apiRequest<any>(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number) =>
    apiRequest<any>(`/campaigns/${id}`, { method: 'DELETE' }),
  send: async (id: number) =>
    apiRequest<any>(`/campaigns/${id}/send`, { method: 'POST' }),
  getProgress: async (id: number) =>
    apiRequest<any>(`/campaigns/${id}/progress`),
  uploadMedia: async (file: File): Promise<ApiResponse<{ url: string; filename: string; mediaType: 'image' | 'video' | 'audio' }>> => {
    const token = localStorage.getItem('token')
    const activeCompanyId = localStorage.getItem('activeCompanyId')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/upload/media`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(activeCompanyId && { 'X-Company-Id': activeCompanyId }),
      },
      body: formData
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Falha no upload do arquivo')
    }

    return payload
  }
}

export const paymentsApi = { 
  update: async (id: number, data: any) => apiRequest<any>(`/pagamentos/${id}`, { method: 'PUT', body: JSON.stringify(data) }) 
};

export const cadenceApi = {
  getByStage: async (stageCode: string) => apiRequest<any>(`/cadence/${stageCode}`),
  update: async (stageCode: string, data: any) => apiRequest<any>(`/cadence/${stageCode}`, { method: 'PUT', body: JSON.stringify(data) })
}
