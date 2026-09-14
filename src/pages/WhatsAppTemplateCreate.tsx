import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  MessageSquareText,
  Phone,
  Plus,
  Reply,
  Send,
  Trash2,
} from 'lucide-react'
import { whatsappTemplatesApi } from '@/lib/api'
import type { CreateWhatsAppTemplateInput, WhatsAppTemplateButton } from '@/types/whatsapp-template'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type DraftButton = {
  id: number
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  value: string
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function variableIndexes(value: string) {
  return Array.from(new Set(Array.from(value.matchAll(/\{\{(\d+)\}\}/g), (match) => Number(match[1]))))
    .sort((left, right) => left - right)
}

function replaceExamples(text: string, examples: string[]) {
  return text.replace(/\{\{(\d+)\}\}/g, (placeholder, index) => examples[Number(index) - 1] || placeholder)
}

function resizeExamples(current: string[], size: number) {
  return Array.from({ length: size }, (_, index) => current[index] || '')
}

function ButtonTypeIcon({ type }: { type: DraftButton['type'] }) {
  if (type === 'URL') return <Link2 className="h-4 w-4" />
  if (type === 'PHONE_NUMBER') return <Phone className="h-4 w-4" />
  return <Reply className="h-4 w-4" />
}

export default function WhatsAppTemplateCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const canManage = localStorage.getItem('userType') === 'professional'
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('pt_BR')
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY')
  const [headerEnabled, setHeaderEnabled] = useState(false)
  const [headerText, setHeaderText] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [headerExamples, setHeaderExamples] = useState<string[]>([])
  const [bodyExamples, setBodyExamples] = useState<string[]>([])
  const [buttons, setButtons] = useState<DraftButton[]>([])

  const headerVariables = useMemo(() => variableIndexes(headerText), [headerText])
  const bodyVariables = useMemo(() => variableIndexes(bodyText), [bodyText])
  const normalizedName = useMemo(() => normalizeName(name), [name])

  useEffect(() => {
    setHeaderExamples((current) => resizeExamples(current, headerVariables.length))
  }, [headerVariables.length])

  useEffect(() => {
    setBodyExamples((current) => resizeExamples(current, bodyVariables.length))
  }, [bodyVariables.length])

  useEffect(() => {
    if (!canManage) navigate('/templates', { replace: true })
  }, [canManage, navigate])

  const addVariable = (target: 'header' | 'body') => {
    if (target === 'header') {
      const next = Math.max(0, ...headerVariables) + 1
      setHeaderText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}{{${next}}}`)
      return
    }
    const next = Math.max(0, ...bodyVariables) + 1
    setBodyText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}{{${next}}}`)
  }

  const addButton = () => {
    if (buttons.length >= 10) return
    setButtons((current) => [...current, { id: Date.now(), type: 'QUICK_REPLY', text: '', value: '' }])
  }

  const updateButton = (id: number, patch: Partial<DraftButton>) => {
    setButtons((current) => current.map((button) => button.id === id ? { ...button, ...patch } : button))
  }

  const applyAppointmentReminderExample = () => {
    const buttonId = Date.now()
    setName('lembrete_de_agendamento')
    setLanguage('pt_BR')
    setCategory('UTILITY')
    setHeaderEnabled(true)
    setHeaderText('Lembrete de agendamento')
    setHeaderExamples([])
    setBodyText('Olá, {{1}}. Seu atendimento na {{2}} está agendado para {{3}}. Responda para confirmar ou solicitar alteração.')
    setBodyExamples(['Maria', 'Clínica Boca', '25/07 às 14h'])
    setFooterText('Mensagem referente ao seu agendamento')
    setButtons([
      { id: buttonId, type: 'QUICK_REPLY', text: 'Confirmar', value: '' },
      { id: buttonId + 1, type: 'QUICK_REPLY', text: 'Solicitar alteração', value: '' },
    ])
    toast({
      title: 'Exemplo de utilidade preenchido',
      description: 'Revise os dados da clínica antes de enviar para análise da Meta.',
    })
  }

  const submit = async () => {
    if (!normalizedName || !bodyText.trim()) {
      toast({ title: 'Revise os campos obrigatórios', description: 'Informe o nome e o corpo da mensagem.', variant: 'destructive' })
      return
    }
    if ([...headerExamples, ...bodyExamples].some((example) => !example.trim())) {
      toast({ title: 'Exemplos incompletos', description: 'A Meta exige um exemplo para cada variável usada.', variant: 'destructive' })
      return
    }

    const payload: CreateWhatsAppTemplateInput = {
      name: normalizedName,
      language,
      category,
      headerText: headerEnabled ? headerText.trim() : undefined,
      headerExamples: headerEnabled ? headerExamples : undefined,
      bodyText: bodyText.trim(),
      bodyExamples,
      footerText: footerText.trim() || undefined,
      buttons: buttons.map((button) => ({
        type: button.type,
        text: button.text.trim(),
        ...(button.type === 'URL' ? { url: button.value.trim() } : {}),
        ...(button.type === 'PHONE_NUMBER' ? { phoneNumber: button.value.trim() } : {}),
      })),
    }

    setSubmitting(true)
    try {
      const response = await whatsappTemplatesApi.create(payload)
      if (!response.success) throw new Error(response.error?.message || 'Não foi possível enviar o template.')
      toast({ title: 'Template confirmado na Meta', description: `ID ${response.data.externalId}. Acompanhe o status na página de templates.` })
      navigate('/templates')
    } catch (error: any) {
      toast({ title: 'Erro ao criar template', description: error.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const previewButtons: WhatsAppTemplateButton[] = buttons.map((button) => ({
    type: button.type,
    text: button.text || 'Ação',
    ...(button.type === 'URL' ? { url: button.value } : {}),
    ...(button.type === 'PHONE_NUMBER' ? { phone_number: button.value } : {}),
  }))

  if (!canManage) return null

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <Button variant="ghost" className="mb-3 -ml-3" onClick={() => navigate('/templates')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para templates
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <MessageSquareText className="h-4 w-4" />
              WhatsApp Oficial
            </div>
            <h1 className="text-3xl font-bold text-slate-950">Novo template</h1>
            <p className="mt-1 text-sm text-slate-600">Crie uma mensagem e envie diretamente para análise da Meta.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={applyAppointmentReminderExample} disabled={submitting}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Usar exemplo de utilidade
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar para análise
            </Button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">Identificação</h2>
              <p className="mt-1 text-sm text-slate-500">Nome interno, idioma e finalidade da mensagem.</p>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="template-name">Nome do template</Label>
                <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="confirmacao_de_agendamento" maxLength={512} />
                <p className="text-xs text-slate-500">Será salvo como <code className="rounded bg-slate-100 px-1.5 py-0.5">{normalizedName || 'nome_do_template'}</code>.</p>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as 'UTILITY' | 'MARKETING')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utilidade</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                    <SelectItem value="es">Espanhol</SelectItem>
                    <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-950">Cabeçalho</h2>
                <p className="mt-1 text-sm text-slate-500">Texto opcional acima da mensagem, até 60 caracteres.</p>
              </div>
              <Switch checked={headerEnabled} onCheckedChange={setHeaderEnabled} aria-label="Ativar cabeçalho" />
            </div>
            {headerEnabled && (
              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="header-text">Texto do cabeçalho</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => addVariable('header')}><Plus className="mr-1.5 h-3.5 w-3.5" />Variável</Button>
                  </div>
                  <Input id="header-text" value={headerText} onChange={(event) => setHeaderText(event.target.value)} maxLength={60} placeholder="Olá, {{1}}" />
                  <p className="text-right text-xs text-slate-400">{headerText.length} / 60</p>
                </div>
                {headerVariables.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {headerVariables.map((index, position) => (
                      <div key={index} className="space-y-2">
                        <Label htmlFor={`header-example-${index}`}>Exemplo de {`{{${index}}}`}</Label>
                        <Input id={`header-example-${index}`} value={headerExamples[position] || ''} onChange={(event) => setHeaderExamples((current) => current.map((value, itemIndex) => itemIndex === position ? event.target.value : value))} placeholder="Maria" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">Corpo da mensagem</h2>
              <p className="mt-1 text-sm text-slate-500">Conteúdo principal enviado ao contato, até 1.024 caracteres.</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="body-text">Mensagem</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addVariable('body')}><Plus className="mr-1.5 h-3.5 w-3.5" />Variável</Button>
                </div>
                <Textarea id="body-text" value={bodyText} onChange={(event) => setBodyText(event.target.value)} maxLength={1024} className="min-h-36 resize-y" placeholder={'Olá, {{1}}! Sua consulta está confirmada para {{2}}.'} />
                <p className="text-right text-xs text-slate-400">{bodyText.length} / 1.024</p>
              </div>
              {bodyVariables.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {bodyVariables.map((index, position) => (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={`body-example-${index}`}>Exemplo de {`{{${index}}}`}</Label>
                      <Input id={`body-example-${index}`} value={bodyExamples[position] || ''} onChange={(event) => setBodyExamples((current) => current.map((value, itemIndex) => itemIndex === position ? event.target.value : value))} placeholder={position === 0 ? 'Maria' : '25/07 às 14h'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">Rodapé</h2>
              <p className="mt-1 text-sm text-slate-500">Texto opcional curto abaixo da mensagem, até 60 caracteres.</p>
            </div>
            <div className="space-y-2 p-5">
              <Input value={footerText} onChange={(event) => setFooterText(event.target.value)} maxLength={60} placeholder="SellClin · Atendimento da clínica" />
              <p className="text-right text-xs text-slate-400">{footerText.length} / 60</p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-950">Botões de ação</h2>
                <p className="mt-1 text-sm text-slate-500">Respostas rápidas, links e telefone. Máximo de 10 botões.</p>
              </div>
              <Button type="button" variant="outline" onClick={addButton} disabled={buttons.length >= 10}><Plus className="mr-2 h-4 w-4" />Adicionar botão</Button>
            </div>
            <div className="space-y-3 p-5">
              {buttons.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Nenhum botão adicionado.</p>}
              {buttons.map((button) => (
                <div key={button.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_40px]">
                  <Select value={button.type} onValueChange={(value) => updateButton(button.id, { type: value as DraftButton['type'], value: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY">Resposta rápida</SelectItem>
                      <SelectItem value="URL">Abrir link</SelectItem>
                      <SelectItem value="PHONE_NUMBER">Ligar</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"><ButtonTypeIcon type={button.type} /></span>
                    <Input value={button.text} onChange={(event) => updateButton(button.id, { text: event.target.value })} maxLength={25} placeholder="Texto do botão" className="pl-9" />
                  </div>
                  {button.type === 'QUICK_REPLY' ? <div className="hidden md:block" /> : (
                    <Input value={button.value} onChange={(event) => updateButton(button.id, { value: event.target.value })} placeholder={button.type === 'URL' ? 'https://sua-clinica.com' : '+5511999999999'} />
                  )}
                  <Button type="button" variant="ghost" size="icon" className="text-red-600" title="Remover botão" onClick={() => setButtons((current) => current.filter((item) => item.id !== button.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="font-bold text-slate-950">Prévia</h2><p className="text-xs text-slate-500">Visualização aproximada</p></div>
              <Badge variant="outline">{language}</Badge>
            </div>
            <div className="rounded-lg bg-[#efeae2] p-3">
              <div className="ml-auto max-w-[300px] overflow-hidden rounded-lg bg-[#d9fdd3] shadow-sm">
                <div className="space-y-2 px-3 py-2.5 text-sm leading-relaxed text-slate-800">
                  {headerEnabled && headerText && <p className="font-bold">{replaceExamples(headerText, headerExamples)}</p>}
                  <p className="min-h-5 whitespace-pre-wrap">{replaceExamples(bodyText, bodyExamples) || 'Sua mensagem aparecerá aqui.'}</p>
                  {footerText && <p className="text-xs text-slate-500">{footerText}</p>}
                  <p className="text-right text-[10px] text-slate-500">12:30</p>
                </div>
                {previewButtons.length > 0 && (
                  <div className="divide-y divide-emerald-100 border-t border-emerald-100 bg-white/60">
                    {previewButtons.map((button, index) => <p key={index} className="px-3 py-2 text-center text-xs font-semibold text-blue-700">{button.text}</p>)}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div><p className="font-bold">Antes de enviar</p><p className="mt-1 leading-relaxed text-blue-800">Use exemplos reais sem dados sensíveis. A categoria pode ser ajustada automaticamente pela Meta.</p></div></div>
          </section>

          {category === 'UTILITY' && (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="font-bold">Template de utilidade</p><p className="mt-1 leading-relaxed text-emerald-800">Use somente para uma ação ou atendimento já solicitado pelo cliente. Promoção, oferta, desconto ou convite comercial será tratado como marketing pela Meta.</p></div></div>
            </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-bold text-slate-950">Validação rápida</p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${normalizedName ? 'text-emerald-600' : 'text-slate-300'}`} />Nome válido</p>
              <p className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${bodyText.trim() ? 'text-emerald-600' : 'text-slate-300'}`} />Mensagem preenchida</p>
              <p className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${[...headerExamples, ...bodyExamples].every(Boolean) ? 'text-emerald-600' : 'text-slate-300'}`} />Exemplos completos</p>
            </div>
            <a href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">Diretrizes da Meta <ExternalLink className="h-3.5 w-3.5" /></a>
          </section>

          {(headerVariables.some((value, index) => value !== index + 1) || bodyVariables.some((value, index) => value !== index + 1)) && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex gap-3"><AlertCircle className="h-5 w-5 shrink-0" /><p>Numere as variáveis em sequência, começando por {`{{1}}`} e sem pular números.</p></div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
