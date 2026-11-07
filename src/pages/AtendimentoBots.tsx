import { useEffect, useState } from 'react'
import FlowEditor from '@/components/bots/FlowEditor'
import { flowTemplate } from '../../server/services/bot-flow-definition'
import WorkflowConnection, { BotPreparation } from '@/components/bots/WorkflowConnection'
import { Bot, Plus, Copy, Trash2, Play, Pause, Send, Save, KeyRound } from 'lucide-react'
import { aiAgentsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type Agent = { id: number; name: string; basePrompt: string; isActive: boolean; updatedAt: string }
type Chat = { role: 'user' | 'assistant'; content: string }
const defaults = { flowDefinition: null, executionMode: 'native', n8nWebhookUrl: '', n8nSecret: '', hasN8nSecret: false, removeN8nSecret: false, n8nTimeoutSeconds: 20, provider: 'openai', model: '', apiKey: '', hasApiKey: false, removeKey: false, verifiedAt: null, playgroundAt: null, knowledge: '', maxResponses: 10, dailyLimit: 200,
  qualificationFields: ['nome', 'email', 'interesse'], handoffTerms: [] as string[], qualifyEnabled: true, bookingEnabled: true, timezone: 'America/Sao_Paulo', workingDays: [1, 2, 3, 4, 5] }
const templates = [
  ['Menu de atendimento', 'Ajude o cliente a escolher entre atendimento com IA e transferência para a equipe.'],
  ['Boas-vindas', 'Cumprimente a pessoa, apresente a clínica usando a base de conhecimento e pergunte como podemos ajudar.'],
  ['Perguntas frequentes', 'Responda às dúvidas com base nas informações da clínica. Quando a informação não estiver cadastrada, encaminhe à equipe.'],
  ['Qualificação de leads', 'Pergunte o nome e o serviço de interesse, uma pergunta por vez. Colete os campos configurados e encaminhe à equipe quando necessário.'],
  ['Agendamento', 'Ajude a escolher um serviço, profissional e data. Consulte horários reais e peça confirmação antes de reservar.'],
  ['Em branco', 'Atenda com cordialidade e objetividade. Use apenas as informações cadastradas pela clínica.'],
]
function unwrap(result: any) { if (!result.success) throw new Error(result.error?.message || 'Não foi possível concluir.'); return result.data }
function Field({ title, children }: { title: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium">{title}{children}</label> }
const panel = 'rounded-xl border bg-card p-5 space-y-4'
const executionReasons: Record<string, string> = {
  workflow_timeout: 'Workflow excedeu o tempo de resposta',
  workflow_configuration: 'Confira a conexão do workflow', workflow_auth: 'Token recusado pelo n8n', workflow_unavailable: 'Workflow indisponível', workflow_invalid_response: 'Confira o tempo e a resposta do workflow',
  requested_human: 'Encaminhado para a equipe', clinical_topic: 'Assunto clínico',
  knowledge_missing: 'Informação não cadastrada', response_limit: 'Limite da conversa atingido',
  daily_limit: 'Limite diário atingido', human_control: 'Atendimento humano assumido',
  manual: 'Pausado pela equipe', booking_disabled: 'Agendamento indisponível',
  media_requires_human: 'Arquivo encaminhado para a equipe', coalesced: 'Mensagens agrupadas',
  credentials: 'Confira a chave e o modelo', quota: 'Confira o saldo e o limite da chave',
  provider_unavailable: 'Provedor de IA indisponível', invalid_response: 'Resposta da IA inválida',
  provider_error: 'Falha ao consultar a IA', execution_failed: 'Falha no atendimento; revise a conversa',
  bot_unavailable: 'Bot indisponível ou desativado', subscription_unavailable: 'Módulo indisponível no plano',
  worker_interrupted: 'Execução interrompida; revise a conversa', bot_deleted: 'Bot excluído',
  resumed_from_next_message: 'Aguardando a próxima mensagem',
}
function executionReason(code?: string) { return code ? executionReasons[code] || 'Revisão pela equipe necessária' : '—' }

export default function AtendimentoBots() {
  const { toast } = useToast()
  const [bots, setBots] = useState<Agent[]>([])
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Agent | null>(null)
  const [config, setConfig] = useState<any>({ ...defaults })
  const [tab, setTab] = useState('config')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [chat, setChat] = useState<Chat[]>([])
  const [state, setState] = useState<any>({})
  const [message, setMessage] = useState('')
  const [handoff, setHandoff] = useState(false)
  const [usage, setUsage] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [approved, setApproved] = useState(false)
  const refresh = async () => {
    try { setBots(unwrap(await aiAgentsApi.list())); setLoadError('') }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os bots.'); throw error }
  }
  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: any) { toast({ title: 'Não foi possível concluir', description: e.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  useEffect(() => { void act(refresh) }, [])
  const load = async (bot: Agent) => {
    const [c, u] = await Promise.all([aiAgentsApi.getConfig(bot.id), aiAgentsApi.usage(bot.id).catch(() => ({ success: false, data: null }))])
    setSelected(bot); setConfig({ ...defaults, ...unwrap(c), apiKey: '', n8nSecret: '', removeKey: false, removeN8nSecret: false }); setUsage(u.success ? u.data : null); setDirty(false); setApproved(false)
    setChat([]); setState({}); setHandoff(false); setCreating(false)
  }
  const change = (key: string, value: any) => { setConfig((c: any) => ({ ...c, [key]: value, ...(key === 'executionMode' && value === 'native' && !c.flowDefinition ? { flowDefinition: flowTemplate() } : {}) })); setDirty(true); setApproved(false) }
  const save = async () => {
    if (!selected) return
    const updated = unwrap(await aiAgentsApi.update(selected.id, { name: selected.name, basePrompt: selected.basePrompt }))
    unwrap(await aiAgentsApi.saveConfig(selected.id, { ...config, ...(config.executionMode !== 'n8n' && !config.flowDefinition ? { flowDefinition: flowTemplate() } : {}) }))
    await refresh(); await load(updated)
    toast({ title: 'Configuração salva', description: 'Teste no Playground antes de ativar o atendimento.' })
  }
  const test = async () => {
    if (!selected || !message.trim()) return
    const text = message.trim()
    const data = unwrap(await aiAgentsApi.playground(selected.id, text, chat, state))
    setChat([...chat, { role: 'user', content: text }, { role: 'assistant', content: data.reply }].slice(-16) as Chat[])
    setState(data.state); setHandoff(Boolean(data.handoff)); setMessage(''); setConfig({ ...config, playgroundAt: new Date().toISOString() })
    setUsage(unwrap(await aiAgentsApi.usage(selected.id)))
  }
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="text-primary" />Fluxos de atendimento</h1><p className="mt-2 text-sm text-muted-foreground">Crie um atendimento com blocos ou conecte um workflow n8n. Um fluxo ativo por clínica.</p></div><Button disabled={busy} onClick={() => setCreating(!creating)}><Plus className="mr-2 h-4 w-4" />Novo fluxo</Button></header>
    {creating && <section className={panel}><h2 className="font-semibold">Comece com um modelo</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{templates.map(([title, prompt]) => <Button key={title} variant="outline" className="h-auto whitespace-normal p-4" disabled={busy} onClick={() => void act(async () => { const bot = unwrap(await aiAgentsApi.create({ name: title === 'Em branco' ? 'Meu bot' : title, basePrompt: prompt, template: title === 'Menu de atendimento' ? 'menu' : title === 'Boas-vindas' ? 'welcome' : title === 'Qualificação de leads' ? 'qualification' : 'blank' })); await refresh(); await load(bot) })}>{title}</Button>)}</div></section>}
    {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">Não foi possível carregar os bots</p><p className="mt-1">{loadError}</p><Button className="mt-3" variant="outline" disabled={busy} onClick={() => void act(refresh)}>Tentar novamente</Button></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3">{!bots.length && !loadError && !busy && <p className={panel}>Crie seu primeiro fluxo. Ele começará como rascunho.</p>}{bots.map(bot => <button key={bot.id} disabled={busy} onClick={() => { if (!dirty || window.confirm('Você tem alterações não salvas. Deseja descartá-las e abrir outro bot?')) void act(() => load(bot)) }} className={`w-full rounded-xl border p-4 text-left ${selected?.id === bot.id ? 'border-primary bg-primary/5' : 'bg-card'}`}><span className="block font-semibold">{bot.name}</span><span className={`text-xs ${bot.isActive ? 'text-green-700' : 'text-muted-foreground'}`}>{bot.isActive ? 'Ativo' : 'Rascunho / inativo'}</span><span className="mt-2 block text-xs text-muted-foreground">Editado em {new Date(bot.updatedAt).toLocaleString('pt-BR')}</span></button>)}</aside>
      {selected && <main className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={tab === 'config' ? 'default' : 'outline'} onClick={() => setTab('config')}>Configuração</Button><Button size="sm" variant={tab === 'playground' ? 'default' : 'outline'} onClick={() => setTab('playground')}>Playground</Button><Button size="sm" variant={tab === 'usage' ? 'default' : 'outline'} onClick={() => { setTab('usage'); void act(async () => setUsage(unwrap(await aiAgentsApi.usage(selected.id)))) }}>Uso e execuções</Button><div className="flex-1" /><Button size="sm" variant="outline" disabled={busy} onClick={() => void act(async () => { const item = unwrap(await aiAgentsApi.duplicate(selected.id)); await refresh(); await load(item) })}><Copy className="mr-1 h-4 w-4" />Duplicar</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (window.confirm(`Excluir o bot ${selected.name}?`)) void act(async () => { unwrap(await aiAgentsApi.delete(selected.id)); setSelected(null); await refresh() }) }}><Trash2 className="h-4 w-4" /><span className="sr-only">Excluir bot</span></Button></div>
        {tab === 'config' && <>
          <BotPreparation saved={!dirty && Boolean(config.flowDefinition || config.hasApiKey || config.hasN8nSecret)} connected={!dirty && Boolean(config.verifiedAt)} tested={!dirty && Boolean(config.playgroundAt)} />
          <WorkflowConnection config={config} dirty={dirty} busy={busy} change={change} test={() => void act(async () => { unwrap(await aiAgentsApi.testKey(selected.id)); setConfig({ ...config, verifiedAt: new Date().toISOString() }); toast({ title: 'Workflow validado' }) })} />
          <section className={panel}><h2 className="font-semibold">Identidade e comportamento</h2><Field title="Nome do fluxo"><Input value={selected.name} maxLength={120} onChange={e => { setSelected({ ...selected, name: e.target.value }); setDirty(true) }} /></Field><Field title="Instruções e tom do atendimento"><Textarea rows={5} value={selected.basePrompt} maxLength={20000} onChange={e => { setSelected({ ...selected, basePrompt: e.target.value }); setDirty(true) }} /></Field><p className="text-xs text-muted-foreground">O bot atende assuntos administrativos. Pedidos de atendimento humano e temas clínicos são encaminhados para a equipe.</p></section>
          {config.executionMode !== 'n8n' && <>
            <section className={panel}><h2 className="font-semibold">IA e conhecimento da clínica</h2><p className="text-sm text-muted-foreground">Provedor, chave, comportamento e base de conhecimento ficam em Configurações → Atendimento e IA.</p><a className="text-sm font-medium text-primary underline" href="/configuracoes?tab=atendimento">Configurar atendimento e IA</a>{!config.sharedSettings && <p className="text-sm text-amber-700">Configure as preferências compartilhadas. Configurações antigas são preservadas até você salvar as da clínica.</p>}<Button variant="outline" disabled={busy || dirty} onClick={() => void act(async () => { unwrap(await aiAgentsApi.testKey(selected.id)); setConfig({ ...config, verifiedAt: new Date().toISOString() }); toast({ title: 'Conexão validada' }) })}>Validar fluxo e conexão</Button>{config.verifiedAt && !dirty && <p className="text-sm text-emerald-700">Conexão validada</p>}</section>
            <FlowEditor value={config.flowDefinition} fields={config.qualificationFields} disabled={busy} onChange={graph => change('flowDefinition', graph)} />
          </>}
          <Button disabled={busy || !selected.name.trim() || (config.executionMode === 'n8n' ? !config.n8nWebhookUrl.trim() : false)} onClick={() => void act(save)}><Save className="mr-2 h-4 w-4" />Salvar fluxo</Button>{dirty && <span className="ml-3 text-sm text-muted-foreground">Há alterações não salvas.</span>}
        </>}
        {tab === 'playground' && <section className={panel}><h2 className="font-semibold">Teste antes de ativar</h2><p className="text-sm text-muted-foreground">O teste usa a conexão configurada e pode consumir créditos. O SellClin não envia WhatsApp nem altera leads ou agenda nesta simulação. Workflows externos devem respeitar o modo playground.</p>{dirty && <p className="text-sm text-amber-700">Salve as alterações na configuração antes de testar.</p>}<div className="max-h-[460px] min-h-48 space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-4" aria-live="polite">{!chat.length && <p className="text-sm text-muted-foreground">Experimente uma dúvida, uma qualificação ou um pedido de agendamento.</p>}{chat.map((m, i) => <div key={i} className={`max-w-[90%] whitespace-pre-wrap rounded-xl p-3 text-sm ${m.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-background border'}`}><strong className="mb-1 block text-xs">{m.role === 'user' ? 'Você' : selected.name}</strong>{m.content}</div>)}</div>{handoff && <p className="text-sm text-amber-700">O bot transferiu esta simulação para a equipe. Reinicie para testar outra conversa.</p>}<form className="flex gap-2" onSubmit={e => { e.preventDefault(); void act(test) }}><Input aria-label="Mensagem de teste" value={message} maxLength={4000} onChange={e => setMessage(e.target.value)} placeholder="Digite uma mensagem" /><Button type="submit" disabled={busy || dirty || !config.verifiedAt || handoff || !message.trim()}><Send className="h-4 w-4" /><span className="sr-only">Enviar teste</span></Button></form><Button variant="outline" onClick={() => { setChat([]); setState({}); setHandoff(false) }}>Reiniciar conversa de teste</Button></section>}
        {tab === 'usage' && <section className={panel}><h2 className="font-semibold">Últimos 30 dias</h2><p className="text-sm">{usage?.totals?._count || 0} execuções • {usage?.totals?._sum?.inputTokens || 0} tokens de entrada • {usage?.totals?._sum?.outputTokens || 0} tokens de saída</p><p className="text-xs text-muted-foreground">O valor cobrado deve ser consultado no provedor da chave. Testes no Playground também consomem tokens.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Data</th><th>Canal</th><th>Estado</th><th>Motivo</th><th>Duração</th></tr></thead><tbody>{usage?.runs?.map((r: any) => <tr key={r.id} className="border-t"><td className="p-2">{new Date(r.createdAt).toLocaleString('pt-BR')}</td><td>{r.mode === 'live' ? 'WhatsApp' : r.mode === 'key_test' ? 'Teste de conexão' : 'Playground'}<span className="block text-xs text-muted-foreground">{r.executionMode === 'n8n' ? 'n8n' : 'IA nativa'}</span></td><td>{({ pending: 'Na fila', processing: 'Processando', sending: 'Enviando', sent: 'Concluído', skipped: 'Ignorado', failed: 'Falhou', uncertain: 'Revisar envio' } as any)[r.status] || r.status}</td><td>{executionReason(r.errorCode)}</td><td>{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td></tr>)}</tbody></table></div></section>}
        <section className={panel}><h2 className="font-semibold">Atendimento automático</h2>{selected.isActive ? <Button disabled={busy} variant="outline" onClick={() => void act(async () => { const bot = unwrap(await aiAgentsApi.update(selected.id, { isActive: false })); await refresh(); setSelected(bot) })}><Pause className="mr-2 h-4 w-4" />Desativar bot</Button> : <><label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />Revisei as respostas do Playground e aprovo a conexão configurada, o compartilhamento de dados com ela e os custos para atender clientes.</label><Button disabled={busy || dirty || !approved || !config.verifiedAt || !config.playgroundAt} onClick={() => void act(async () => { const bot = unwrap(await aiAgentsApi.activate(selected.id)); await refresh(); setSelected(bot); toast({ title: 'Bot ativado', description: 'O bot anterior foi desativado. Conversas em atendimento humano continuam pausadas.' }) })}><Play className="mr-2 h-4 w-4" />Ativar para esta clínica</Button></>}</section>
      </main>}
    </div>
  </div>
}
