import { useEffect, useState } from 'react'
import { CheckCircle2, FlaskConical, Pause, Play, Save, Send, Workflow } from 'lucide-react'
import { aiAgentsApi } from '@/lib/api'
import WorkflowConnection from '@/components/bots/WorkflowConnection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

function unwrap(r: any) { if (!r.success) throw new Error(r.error?.message || 'Não foi possível concluir.'); return r.data }
const empty = { executionMode: 'n8n', n8nWebhookUrl: '', n8nSecret: '', n8nTimeoutSeconds: 20, hasN8nSecret: false, verifiedAt: null, playgroundAt: null }
export default function N8nSettings() {
  const { toast } = useToast()
  const [agent, setAgent] = useState<any>(null)
  const [config, setConfig] = useState<any>(empty)
  const [choices, setChoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [approved, setApproved] = useState(false)
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<{ role: string; content: string }[]>([])
  const [state, setState] = useState({})
  const [handoff, setHandoff] = useState(false)
  function resetChat() { setChat([]); setState({}); setHandoff(false); setApproved(false) }
  async function select(item: any, c?: any) {
    const settings = c || unwrap(await aiAgentsApi.getConfig(item.id))
    setAgent(item); setConfig({ ...empty, ...settings, executionMode: 'n8n', n8nSecret: '', removeN8nSecret: false }); setDirty(false); resetChat()
  }
  async function load() {
    setLoading(true)
    try {
      const bots = unwrap(await aiAgentsApi.list())
      const all = await Promise.all(bots.map(async (bot: any) => ({ bot, config: unwrap(await aiAgentsApi.getConfig(bot.id)) })))
      const external = all.filter(entry => entry.config?.executionMode === 'n8n')
      setChoices(external.map(entry => entry.bot))
      const preferred = external.find(entry => entry.bot.isActive) || external[0]
      if (preferred) await select(preferred.bot, preferred.config)
      setError('')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } catch (e: any) { toast({ title: 'Não foi possível concluir', description: e.message, variant: 'destructive' }) } finally { setBusy(false) } }
  const change = (key: string, value: any) => { setConfig((c: any) => ({ ...c, [key]: value })); setDirty(true); resetChat() }
  async function save() {
    let current = agent
    if (!current) {
      current = unwrap(await aiAgentsApi.create({ name: 'Atendimento n8n', basePrompt: 'Siga as regras do workflow da clínica e encaminhe à equipe quando necessário.' }))
      setAgent(current)
    }
    unwrap(await aiAgentsApi.saveConfig(current.id, { ...config, executionMode: 'n8n' }))
    await select({ ...current, isActive: false })
    toast({ title: 'Conexão salva', description: 'Teste o workflow e uma conversa antes de ativar.' })
  }
  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3"><Workflow className="h-6 w-6 text-primary" /></div><div><h2 className="text-2xl font-semibold">Atendimento com n8n</h2><p className="mt-2 text-sm text-muted-foreground">Conecte o workflow desta clínica. O SellClin recebe as mensagens e envia as respostas pelo WhatsApp.</p></div></header>
    {loading ? <p role="status">Carregando conexão…</p> : error ? <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div> : <>
      {choices.length > 1 && <label className="grid gap-2 text-sm">Conexão existente<select disabled={busy} className="rounded-lg border bg-background p-3" value={agent?.id || ''} onChange={e => { if (!dirty || window.confirm('Descartar alterações não salvas?')) void act(() => select(choices.find(c => c.id === Number(e.target.value)))) }}>{choices.map(c => <option key={c.id} value={c.id}>{c.name}{c.isActive ? ' · Ativo' : ''}</option>)}</select></label>}
      <WorkflowConnection config={config} dirty={dirty} busy={busy} n8nOnly change={change} test={() => void act(async () => { unwrap(await aiAgentsApi.testKey(agent.id)); setConfig((c: any) => ({ ...c, verifiedAt: new Date().toISOString() })); toast({ title: 'Workflow validado' }) })} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{dirty ? 'Alterações não salvas. Salvar desativa este atendimento até você validá-lo novamente.' : 'O token salvo não volta a ser exibido.'}</p><Button disabled={busy || !config.n8nWebhookUrl || (!config.hasN8nSecret && !config.n8nSecret) || (!dirty && Boolean(agent))} onClick={() => void act(save)}><Save className="mr-2 h-4 w-4" />Salvar conexão</Button></div>
      <section className="space-y-4 rounded-xl border bg-card p-5"><h3 className="flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4" />Teste de conversa</h3><p className="text-sm text-muted-foreground">Salve e teste a conexão primeiro. Esta simulação não envia WhatsApp nem altera o CRM. O workflow deve respeitar o modo de teste.</p>
        <div aria-live="polite" className="max-h-80 min-h-24 space-y-3 overflow-auto rounded-lg bg-muted/30 p-3">{chat.length === 0 && <p className="text-sm text-muted-foreground">Envie uma mensagem para conferir o retorno do workflow.</p>}{chat.map((m, i) => <p key={i} className={`whitespace-pre-wrap rounded-lg border p-3 text-sm ${m.role === 'user' ? 'ml-8 bg-primary/5' : 'mr-8 bg-background'}`}><strong>{m.role === 'user' ? 'Você' : 'n8n'}: </strong>{m.content}</p>)}</div>
        {handoff && <p className="text-sm text-amber-700">O workflow transferiu esta conversa à equipe. Reinicie para testar novamente.</p>}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void act(async () => { const text = message.trim(); if (!text) return; const result = unwrap(await aiAgentsApi.playground(agent.id, text, chat, state)); setChat([...chat, { role: 'user', content: text }, { role: 'assistant', content: result.reply }]); setState(result.state || {}); setHandoff(Boolean(result.handoff)); setMessage(''); setConfig((c: any) => ({ ...c, playgroundAt: new Date().toISOString() })) }) }}><Input aria-label="Mensagem de teste" value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} placeholder="Digite uma mensagem de teste" /><Button type="submit" disabled={busy || dirty || !config.verifiedAt || !message.trim() || handoff}><Send className="h-4 w-4" /><span className="sr-only">Enviar teste</span></Button></form><Button variant="ghost" onClick={resetChat}>Reiniciar teste</Button>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5"><h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Atendimento no WhatsApp</h3><p className="text-sm text-muted-foreground">Uma conexão ativa por clínica. Ao ativar, o atendimento automático anterior é desativado. Conversas assumidas pela equipe continuam com atendimento humano.</p>{agent?.isActive ? <Button variant="outline" disabled={busy} onClick={() => void act(async () => { const bot = unwrap(await aiAgentsApi.update(agent.id, { isActive: false })); setAgent(bot) })}><Pause className="mr-2 h-4 w-4" />Desativar atendimento</Button> : <><label className="flex gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />Revisei o teste e aprovo o envio dos dados da clínica ao workflow e os custos envolvidos.</label><Button disabled={busy || dirty || !agent || !config.verifiedAt || !config.playgroundAt || !approved} onClick={() => void act(async () => { setAgent(unwrap(await aiAgentsApi.activate(agent.id))); toast({ title: 'Atendimento n8n ativado' }) })}><Play className="mr-2 h-4 w-4" />Ativar atendimento n8n</Button></>}</section>
    </>}
  </div>
}
