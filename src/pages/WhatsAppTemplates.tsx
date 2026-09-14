import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  ExternalLink,
  Send,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { whatsappTemplatesApi } from '@/lib/api'
import type { WhatsAppTemplate, WhatsAppTemplateComponent } from '@/types/whatsapp-template'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  NOT_FOUND: { label: 'Não encontrado na Meta', className: 'border-red-200 bg-red-50 text-red-700', icon: AlertCircle },
  UNKNOWN: { label: 'Status a confirmar', className: 'border-slate-200 bg-slate-50 text-slate-600', icon: Clock3 },
  APPROVED: { label: 'Aprovado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  PENDING: { label: 'Em análise', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock3 },
  PENDING_DELETION: { label: 'Exclusão pendente', className: 'border-slate-200 bg-slate-50 text-slate-600', icon: Clock3 },
  REJECTED: { label: 'Rejeitado', className: 'border-red-200 bg-red-50 text-red-700', icon: XCircle },
  PAUSED: { label: 'Pausado', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: AlertCircle },
  DISABLED: { label: 'Desativado', className: 'border-slate-200 bg-slate-50 text-slate-600', icon: XCircle },
}

function statusMeta(status: string) {
  return STATUS_META[String(status || '').toUpperCase()] || {
    label: status || 'Desconhecido',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    icon: Clock3,
  }
}

function categoryLabel(category: string) {
  if (category === 'UTILITY') return 'Utilidade'
  if (category === 'MARKETING') return 'Marketing'
  if (category === 'AUTHENTICATION') return 'Autenticação'
  return category || 'Sem categoria'
}

function getComponent(template: WhatsAppTemplate, type: WhatsAppTemplateComponent['type']) {
  return template.components?.find((component) => component.type === type)
}

function replaceExamples(text: string, examples: string[]) {
  return text.replace(/\{\{(\d+)\}\}/g, (placeholder, index) => examples[Number(index) - 1] || placeholder)
}

function TemplateStatus({ status }: { status: string }) {
  const meta = statusMeta(status)
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={`gap-1 rounded-full px-2.5 py-1 font-bold ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  )
}

function TemplatePreview({ template }: { template: WhatsAppTemplate }) {
  const header = getComponent(template, 'HEADER')
  const body = getComponent(template, 'BODY')
  const footer = getComponent(template, 'FOOTER')
  const buttons = getComponent(template, 'BUTTONS')?.buttons || []
  const headerExamples = header?.example?.header_text || []
  const bodyExamples = body?.example?.body_text?.[0] || []

  return (
    <div className="rounded-lg border border-slate-200 bg-[#efeae2] p-4">
      <div className="ml-auto max-w-[340px] overflow-hidden rounded-lg bg-[#d9fdd3] shadow-sm">
        <div className="space-y-2 px-3 py-2.5 text-sm leading-relaxed text-slate-800">
          {header?.text && <p className="font-bold">{replaceExamples(header.text, headerExamples)}</p>}
          <p className="whitespace-pre-wrap">{replaceExamples(body?.text || '', bodyExamples)}</p>
          {footer?.text && <p className="text-xs text-slate-500">{footer.text}</p>}
          <p className="text-right text-[10px] text-slate-500">12:30</p>
        </div>
        {buttons.length > 0 && (
          <div className="divide-y divide-emerald-100 border-t border-emerald-100 bg-white/60">
            {buttons.map((button, index) => (
              <div key={`${button.type}-${index}`} className="px-3 py-2 text-center text-xs font-semibold text-blue-700">
                {button.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function WhatsAppTemplates() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [creatingReminder, setCreatingReminder] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [preview, setPreview] = useState<WhatsAppTemplate | null>(null)
  const [pendingDelete, setPendingDelete] = useState<WhatsAppTemplate | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [wabaId, setWabaId] = useState<string | null>(null)
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null)
  const [resubmittingId, setResubmittingId] = useState<number | null>(null)
  const syncInFlight = useRef(false)
  const canManage = localStorage.getItem('userType') === 'professional'

  const load = useCallback(async () => {
    const response = await whatsappTemplatesApi.list()
    if (!response.success) throw new Error(response.error?.message || 'Não foi possível carregar os templates.')
    setTemplates((response.data || []) as WhatsAppTemplate[])
    setWabaId(response.templateAccount?.wabaId || null)
  }, [])

  const refresh = useCallback(async () => {
    if (syncInFlight.current) return
    syncInFlight.current = true
    setSyncing(true)
    try {
      const response = await whatsappTemplatesApi.list(undefined, true)
      if (!response.success) throw new Error(response.error?.message || 'Não foi possível consultar a Meta.')
      setTemplates((response.data || []) as WhatsAppTemplate[])
      setWabaId(response.templateAccount?.wabaId || null)
      setVerifiedAt(new Date())
      setSyncError(null)
    } catch (error: any) {
      setSyncError(error.message || 'Não foi possível consultar a Meta.')
    } finally {
      syncInFlight.current = false
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void load()
      .catch((error: Error) => toast({ title: 'Erro ao carregar templates', description: error.message, variant: 'destructive' }))
      .finally(() => { if (active) { setLoading(false); void refresh() } })
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [load, refresh, toast])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return templates.filter((template) => {
      const matchesSearch = !search || `${template.name} ${template.language} ${template.category}`.toLowerCase().includes(search)
      const matchesStatus = status === 'all' || template.status.toUpperCase() === status
      const matchesCategory = category === 'all' || template.category.toUpperCase() === category
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [category, query, status, templates])

  const counts = useMemo(() => ({
    total: templates.length,
    approved: templates.filter((template) => template.status.toUpperCase() === 'APPROVED').length,
    pending: templates.filter((template) => template.status.toUpperCase() === 'PENDING').length,
    rejected: templates.filter((template) => template.status.toUpperCase() === 'REJECTED').length,
  }), [templates])

  const summaryItems = [
    { label: 'Total', value: counts.total, icon: <FileText className="h-5 w-5 text-slate-700" /> },
    { label: 'Aprovados', value: counts.approved, icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
    { label: 'Em análise', value: counts.pending, icon: <Clock3 className="h-5 w-5 text-amber-600" /> },
    { label: 'Rejeitados', value: counts.rejected, icon: <XCircle className="h-5 w-5 text-red-600" /> },
  ]

  const resubmit = async (template: WhatsAppTemplate) => {
    setResubmittingId(template.id)
    try {
      const response = await whatsappTemplatesApi.resubmit(template.id)
      if (!response.success) throw new Error(response.error?.message || 'Não foi possível reenviar o template.')
      await load()
      toast({ title: 'Template confirmado na Meta', description: `ID ${response.data.externalId}` })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Erro ao reenviar', description: error.message, variant: 'destructive' })
    } finally {
      setResubmittingId(null)
    }
  }

  const remove = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await whatsappTemplatesApi.delete(pendingDelete.id)
      if (!response.success) throw new Error(response.error?.message || 'Não foi possível excluir o template.')
      setTemplates((current) => current.filter((template) => template.id !== pendingDelete.id))
      toast({ title: 'Template excluído', description: `${pendingDelete.name} foi removido da Meta.` })
      setPendingDelete(null)
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const createAppointmentReminder = async () => {
    setCreatingReminder(true)
    try {
      const response = await whatsappTemplatesApi.createAppointmentReminder()
      if (!response.success) throw new Error(response.error?.message || 'Não foi possível enviar o template para a Meta.')
      await load()
      toast({
        title: 'Template confirmado na Meta',
        description: `ID ${response.data.externalId}. O lembrete ficará disponível após a aprovação.`,
      })
    } catch (error: any) {
      toast({ title: 'Erro ao criar template', description: error.message, variant: 'destructive' })
    } finally {
      setCreatingReminder(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            WhatsApp Oficial
          </div>
          <h1 className="text-3xl font-bold text-slate-950">Templates de mensagem</h1>
          <p className="mt-1 text-sm text-slate-600">Acompanhe a revisão da Meta e gerencie mensagens para contatos fora da janela de 24 horas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Sincronizar
          </Button>
          {canManage && (
            <Button onClick={() => navigate('/templates/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo template
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        {wabaId && <a href={`https://business.facebook.com/wa/manage/message-templates/?waba_id=${encodeURIComponent(wabaId)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-700 hover:underline">Conta WhatsApp {wabaId}<ExternalLink className="h-3.5 w-3.5" /></a>}
        <span>{syncing ? 'Consultando a Meta...' : verifiedAt ? `Última consulta: ${verifiedAt.toLocaleTimeString('pt-BR')}` : 'Status ainda não verificado nesta sessão'}</span>
      </div>
      {syncError && <div role="alert" className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Não foi possível atualizar os status na Meta.</p><p className="mt-1 break-words">{syncError}</p><p className="mt-1">Os status exibidos são da última consulta salva.</p></div>}

      <section className="grid grid-cols-2 border-y border-slate-200 bg-white md:grid-cols-4">
        {summaryItems.map((item, index) => (
          <div key={item.label} className={`flex items-center gap-3 px-4 py-4 ${index % 2 === 0 ? 'border-r' : ''} md:border-r md:last:border-r-0`}>
            {item.icon}
            <div>
              <p className="text-2xl font-bold text-slate-950">{item.value}</p>
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, idioma ou categoria" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full lg:w-56"><SelectValue>{status === 'all' ? 'Todos os status' : statusMeta(status).label}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="APPROVED">Aprovados</SelectItem>
              <SelectItem value="PENDING">Em análise</SelectItem>
              <SelectItem value="REJECTED">Rejeitados</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
              <SelectItem value="NOT_FOUND">Não encontrados na Meta</SelectItem>
              <SelectItem value="UNKNOWN">Status a confirmar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full lg:w-48"><SelectValue>{category === 'all' ? 'Todas as categorias' : categoryLabel(category)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="UTILITY">Utilidade</SelectItem>
              <SelectItem value="MARKETING">Marketing</SelectItem>
              <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Template</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-950">{template.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{template.externalId ? `ID ${template.externalId}` : 'Sem confirmação de criação na Meta'}</p>
                      {template.rejectionReason && <p className="mt-1 max-w-xl text-xs text-red-600">{template.rejectionReason}</p>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{categoryLabel(template.category)}</Badge></TableCell>
                    <TableCell><TemplateStatus status={template.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{template.language}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setPreview(template)}><Eye className="h-4 w-4" /></Button>
                        {canManage && template.status === 'NOT_FOUND' && <Button variant="ghost" size="icon" title="Reenviar para a Meta" aria-label="Reenviar para a Meta" disabled={resubmittingId !== null || syncing} onClick={() => void resubmit(template)}>{resubmittingId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>}
                        {canManage && <Button variant="ghost" size="icon" title="Excluir" className="text-red-600 hover:text-red-700" onClick={() => setPendingDelete(template)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-slate-200 md:hidden">
            {filtered.map((template) => (
              <div key={template.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-950">{template.name}</p><p className="mt-1 text-xs text-slate-500">{categoryLabel(template.category)} · {template.language}</p></div>
                  <TemplateStatus status={template.status} />
                </div>
                {template.rejectionReason && <p className="text-xs text-red-600">{template.rejectionReason}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreview(template)}><Eye className="mr-2 h-4 w-4" />Visualizar</Button>
                  {canManage && template.status === 'NOT_FOUND' && <Button variant="outline" size="icon" title="Reenviar para a Meta" aria-label="Reenviar para a Meta" disabled={resubmittingId !== null || syncing} onClick={() => void resubmit(template)}>{resubmittingId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>}
                  {canManage && <Button variant="outline" size="sm" className="text-red-600" onClick={() => setPendingDelete(template)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-16 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">Nenhum template encontrado</p>
              <p className="mt-1 text-sm text-slate-500">Envie um lembrete de agendamento para validar a integração com a Meta.</p>
              {canManage && status === 'all' && category === 'all' && !query && (
                <Button className="mt-5" onClick={() => void createAppointmentReminder()} disabled={creatingReminder}>
                  {creatingReminder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Criar template de teste
                </Button>
              )}
            </div>
          )}
          {loading && <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Carregando templates</div>}
        </div>
      </section>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              {preview && <><TemplateStatus status={preview.status} /><span>{categoryLabel(preview.category)} · {preview.language}</span></>}
            </DialogDescription>
          </DialogHeader>
          {preview && <TemplatePreview template={preview} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template da Meta?</AlertDialogTitle>
            <AlertDialogDescription>O modelo <strong>{pendingDelete?.name}</strong> deixará de ficar disponível para novas mensagens e campanhas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void remove() }} className="bg-red-600 text-white hover:bg-red-700">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
