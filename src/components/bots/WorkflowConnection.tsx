import { Workflow, Bot, ArrowRight, ShieldCheck, ExternalLink, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = { config: any; dirty: boolean; busy: boolean; change: (key: string, value: any) => void; test: () => void }
export function BotPreparation({ saved, connected, tested }: { saved: boolean; connected: boolean; tested: boolean }) {
  return <ol className="grid gap-3 sm:grid-cols-3" aria-label="Preparação do bot">
    {[[saved, '1. Configure', 'Escolha como o bot atende'], [connected, '2. Conecte', 'Valide a conexão'], [tested, '3. Experimente', 'Revise no Playground']].map(([done, title, description]) => <li key={String(title)} className={`flex gap-3 rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20' : 'bg-card'}`}>
      {done ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}<div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
    </li>)}
  </ol>
}
export default function WorkflowConnection({ config, dirty, busy, change, test }: Props) {
  const external = config.executionMode === 'n8n'
  return <section className="space-y-5 rounded-xl border bg-card p-5">
    <div><h2 className="text-lg font-semibold">Como seu bot vai atender?</h2><p className="mt-1 text-sm text-muted-foreground">O SellClin cuida das conversas, da equipe e dos agendamentos nos dois modos.</p></div>
    <div role="group" aria-label="Mecanismo de execução" className="grid gap-3 sm:grid-cols-2">
      {[{ value: 'native', title: 'IA nativa', description: 'Configure a IA diretamente aqui.', Icon: Bot }, { value: 'n8n', title: 'Workflow n8n', description: 'Use suas regras e automações externas.', Icon: Workflow }].map(({ value, title, description, Icon }) => <button key={value} type="button" disabled={busy} aria-pressed={(config.executionMode || 'native') === value} onClick={() => change('executionMode', value)} className={`flex gap-3 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${(config.executionMode || 'native') === value ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50 hover:border-muted-foreground/30'}`}>
        <Icon className="mt-1 h-6 w-6 shrink-0 text-primary" /><div><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></div>
      </button>)}
    </div>
    {external && <div className="space-y-5 border-t pt-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs font-medium"><span>WhatsApp</span><ArrowRight className="h-3 w-3" /><span>SellClin</span><ArrowRight className="h-3 w-3" /><span>Seu workflow</span><ArrowRight className="h-3 w-3" /><span>Resposta pelo SellClin</span></div>
      <label className="grid gap-2 text-sm font-medium">URL de produção do webhook<Input type="url" value={config.n8nWebhookUrl || ''} placeholder="https://automacoes.suaclinica.com/webhook/atendimento" onChange={e => change('n8nWebhookUrl', e.target.value.trim())} /><span className="text-xs font-normal text-muted-foreground">Use a URL de produção de um workflow publicado. A URL de teste não é aceita.</span></label>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
        <label className="grid gap-2 text-sm font-medium">{config.hasN8nSecret ? 'Substituir token (opcional)' : 'Token do workflow'}<Input type="password" autoComplete="new-password" value={config.n8nSecret || ''} placeholder={config.hasN8nSecret ? 'Token salvo com segurança' : 'Cole o token configurado no n8n'} onChange={e => change('n8nSecret', e.target.value)} /></label>
        <label className="grid gap-2 text-sm font-medium">Limite de espera (s)<Input type="number" min={5} max={25} value={config.n8nTimeoutSeconds || 20} onChange={e => change('n8nTimeoutSeconds', Number(e.target.value))} /></label>
      </div>
      {config.hasN8nSecret && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(config.removeN8nSecret)} onChange={e => change('removeN8nSecret', e.target.checked)} />Remover o token ao salvar</label>}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />O token fica criptografado. Ao alterar o endereço do workflow, informe o token novamente.</p>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">As mensagens, os dados do contato e a base de conhecimento serão enviados ao n8n configurado pela clínica. O Playground também chama esse workflow: mantenha os modos de teste sem efeitos externos.</div>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || dirty || !config.hasN8nSecret} onClick={test}>Testar workflow</Button><span role="status" className="text-sm text-muted-foreground">{config.verifiedAt && !dirty ? 'Workflow validado' : 'Salve a configuração antes de testar'}</span><a href="/examples/sellclin-n8n.json" download className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4">Baixar workflow de exemplo<ExternalLink className="h-3 w-3" /></a></div>
      <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Como preparar o n8n</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground"><li>Importe o exemplo e configure Header Auth no Webhook: cabeçalho Authorization, valor Bearer seguido do token.</li><li>Personalize a decisão usando as ações answer, qualify, slots ou handoff.</li><li>Devolva o JSON pelo nó Respond to Webhook, dentro do limite de espera.</li><li>Publique o workflow, salve a conexão aqui e teste no Playground.</li></ol><p className="mt-3 text-xs">O exemplo transfere à equipe até você personalizar as regras. O workflow não deve enviar WhatsApp ou gravar agendamentos diretamente.</p></details>
    </div>}
  </section>
}
