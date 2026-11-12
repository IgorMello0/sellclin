import { useRef, useState } from 'react'
import { Plus, Trash2, ZoomIn, ZoomOut, GitBranch, MousePointer2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { flowNodeTypes, flowTemplate, nodeLabels, nodePorts, validateFlow, type BotFlow, type FlowNode } from '../../../server/services/bot-flow-definition'

const colors: Record<string, string> = { start: 'border-emerald-400', message: 'border-blue-400', menu: 'border-violet-400', collect: 'border-teal-400', condition: 'border-orange-400', ai: 'border-indigo-400', handoff: 'border-rose-400', end: 'border-slate-400' }
export default function FlowEditor({ value, onChange, fields = [], disabled = false }: { value: BotFlow | null; onChange: (graph: BotFlow) => void; fields?: string[]; disabled?: boolean }) {
  const graph = value || flowTemplate()
  const [selected, setSelected] = useState<string | null>(null)
  const [connection, setConnection] = useState<{ from: string; port: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ id: string; x: number; y: number; clientX: number; clientY: number } | null>(null)
  const node = graph.nodes.find(n => n.id === selected)
  const errors = validateFlow(graph)
  const width = Math.max(850, ...graph.nodes.map(n => n.x + 340))
  const height = Math.max(620, ...graph.nodes.map(n => n.y + 240))
  function updateNode(id: string, patch: Partial<FlowNode>) { onChange({ ...graph, nodes: graph.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }) }
  function connect(from: string, port: string, to: string) {
    if (disabled) return
    onChange({ ...graph, edges: [...graph.edges.filter(e => !(e.from === from && e.port === port)), ...(to ? [{ from, to, port }] : [])] }); setConnection(null)
  }
  function add(type: FlowNode['type']) {
    const id = `node_${crypto.randomUUID().slice(0, 8)}`
    onChange({ ...graph, nodes: [...graph.nodes, { id, type, x: 400, y: Math.min(4800, 60 + graph.nodes.length * 100), text: '', field: type === 'collect' ? fields[0] || 'nome' : '', value: '', options: type === 'menu' ? ['Opção 1', 'Opção 2'] : [] }] }); setSelected(id)
  }
  return <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Editor visual do fluxo">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="flex items-center gap-2 font-semibold"><GitBranch className="h-4 w-4 text-primary" />Fluxo de atendimento</h2><p className="mt-1 text-xs text-muted-foreground">Conecte as saídas dos blocos e teste o percurso no Playground.</p></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setZoom(Math.max(.5, zoom - .1))} aria-label="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button><span className="self-center text-xs">{Math.round(zoom * 100)}%</span><Button size="sm" variant="ghost" onClick={() => setZoom(Math.min(1.5, zoom + .1))} aria-label="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button></div></header>
    <div className="flex flex-wrap gap-2 border-b bg-muted/20 p-3">{flowNodeTypes.filter(t => t !== 'start').map(t => <Button key={t} size="sm" variant="outline" disabled={disabled || graph.nodes.length >= 60} onClick={() => add(t)}><Plus className="mr-1 h-3 w-3" />{nodeLabels[t]}</Button>)}</div>
    {connection && <div className="flex items-center justify-between bg-primary/10 px-4 py-2 text-sm" role="status">Escolha a entrada do bloco de destino.<Button size="sm" variant="ghost" onClick={() => setConnection(null)}>Cancelar conexão</Button></div>}
    <div className="grid xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="h-[600px] overflow-auto bg-slate-50 dark:bg-slate-950" style={{ backgroundImage: 'radial-gradient(#94a3b840 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        <div style={{ width: width * zoom, height: height * zoom }}><div className="relative origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
          <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-label="Conexões do fluxo"><defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#64748b" /></marker></defs>{graph.edges.map((edge, i) => {
            const from = graph.nodes.find(n => n.id === edge.from), to = graph.nodes.find(n => n.id === edge.to)
            if (!from || !to) return null
            const x = from.x + 250, y = from.y + 55 + Math.max(0, nodePorts(from).indexOf(edge.port)) * 26, tx = to.x, ty = to.y + 30
            return <path key={i} d={`M ${x} ${y} C ${x + 70} ${y}, ${tx - 70} ${ty}, ${tx} ${ty}`} fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#flow-arrow)" />
          })}</svg>
          {graph.nodes.map(n => <div key={n.id} className={`absolute w-[250px] rounded-xl border-2 bg-card shadow-sm ${colors[n.type]} ${selected === n.id ? 'ring-4 ring-primary/15' : ''}`} style={{ left: n.x, top: n.y }}>
            <button disabled={disabled} className="flex w-full touch-none items-center gap-2 rounded-t-lg bg-muted/40 px-3 py-3 text-left text-sm font-semibold" onClick={() => setSelected(n.id)} onPointerDown={e => { if (disabled || e.button !== 0) return; setSelected(n.id); drag.current = { id: n.id, x: n.x, y: n.y, clientX: e.clientX, clientY: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { const d = drag.current; if (!d || d.id !== n.id) return; updateNode(n.id, { x: Math.min(5000, Math.max(20, d.x + (e.clientX - d.clientX) / zoom)), y: Math.min(5000, Math.max(20, d.y + (e.clientY - d.clientY) / zoom)) }) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><MousePointer2 className="h-3 w-3" />{nodeLabels[n.type]}</button>
            {n.type !== 'start' && <button disabled={!connection || disabled} aria-label={`Conectar entrada de ${nodeLabels[n.type]} ${n.id}`} className="absolute -left-2 top-5 h-4 w-4 rounded-full border-2 border-slate-400 bg-background disabled:opacity-50" onClick={() => connection && connect(connection.from, connection.port, n.id)} />}
            <button className="w-full px-3 py-3 text-left text-xs text-muted-foreground" onClick={() => setSelected(n.id)}>{n.text ? n.text.slice(0, 100) : n.type === 'ai' ? 'Dúvidas, qualificação e agendamento com a IA da clínica.' : n.type === 'start' ? 'Nova mensagem recebida' : 'Clique para configurar'}</button>
            {nodePorts(n).map((port, i) => <button key={port} disabled={disabled} className="absolute -right-2 flex items-center gap-1 text-xs" style={{ top: 47 + i * 26 }} aria-label={`Conectar saída ${port} de ${n.id}`} onClick={() => setConnection({ from: n.id, port })}><span className="rounded bg-background px-1">{port === 'next' ? 'Próximo' : port === 'yes' ? 'Sim' : port === 'no' ? 'Não' : port}</span><span className="h-4 w-4 rounded-full border-2 border-primary bg-background" /></button>)}
            {n.type === 'menu' && <div style={{ height: Math.max(0, n.options.length * 26 - 30) }} />}
          </div>)}
        </div></div>
      </div>
      <aside className="space-y-4 border-l p-4" aria-label="Propriedades do bloco">{node ? <>
        <div className="flex items-center justify-between"><h3 className="font-semibold">{nodeLabels[node.type]}</h3>{node.type !== 'start' && <Button size="sm" variant="ghost" disabled={disabled} aria-label="Excluir bloco" onClick={() => { onChange({ ...graph, nodes: graph.nodes.filter(n => n.id !== node.id), edges: graph.edges.filter(e => e.from !== node.id && e.to !== node.id) }); setSelected(null) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>
        {!['start', 'condition', 'ai'].includes(node.type) && <label className="grid gap-2 text-sm">Mensagem<Textarea disabled={disabled} rows={5} maxLength={3000} value={node.text} onChange={e => updateNode(node.id, { text: e.target.value })} /></label>}
        {['collect', 'condition'].includes(node.type) && <label className="grid gap-2 text-sm">Campo<select disabled={disabled} className="rounded border bg-background p-2" value={node.field} onChange={e => updateNode(node.id, { field: e.target.value })}><option value="">Selecione</option>{fields.map(f => <option key={f}>{f}</option>)}</select></label>}
        {node.type === 'condition' && <label className="grid gap-2 text-sm">É igual a<Input disabled={disabled} maxLength={300} value={node.value} onChange={e => updateNode(node.id, { value: e.target.value })} /></label>}
        {node.type === 'menu' && <label className="grid gap-2 text-sm">Opções (uma por linha)<Textarea disabled={disabled} rows={6} value={node.options.join('\n')} onChange={e => updateNode(node.id, { options: e.target.value.split('\n').slice(0, 8) })} /><span className="text-xs text-muted-foreground">O cliente responde pelo número. Funciona com Meta e Uazapi.</span></label>}
        {node.type === 'ai' && <p className="text-sm text-muted-foreground">Continua a conversa com as instruções deste fluxo e a base da clínica. Consulta a agenda e só confirma reservas após a confirmação do cliente.</p>}
        {nodePorts(node).map(port => <label key={port} className="grid gap-2 text-sm">Destino: {port === 'next' ? 'próximo' : port === 'yes' ? 'sim' : port === 'no' ? 'não' : port}<select disabled={disabled} className="rounded border bg-background p-2" value={graph.edges.find(e => e.from === node.id && e.port === port)?.to || ''} onChange={e => connect(node.id, port, e.target.value)}><option value="">Não conectado</option>{graph.nodes.filter(n => n.id !== node.id && n.type !== 'start').map(n => <option key={n.id} value={n.id}>{nodeLabels[n.type]} · {n.text.slice(0, 25) || n.id}</option>)}</select></label>)}
      </> : <p className="text-sm text-muted-foreground">Selecione um bloco para editar. Arraste pelo título para organizar o fluxo. Use as saídas ou os campos de destino para conectar.</p>}</aside>
    </div>
    <footer className={`border-t px-5 py-3 text-sm ${errors.length ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : 'text-emerald-700'}`} aria-live="polite">{errors.length ? <><strong>Antes de testar ou ativar:</strong><ul className="mt-1 list-disc pl-5">{errors.map(e => <li key={e}>{e}</li>)}</ul></> : 'Todas as conexões estão prontas. Salve e teste o atendimento.'}</footer>
  </section>
}
