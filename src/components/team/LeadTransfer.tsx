import { useEffect, useState } from 'react'
import { usuariosApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type Preview = NonNullable<Awaited<ReturnType<typeof usuariosApi.leadTransferPreview>>['data']>

export function LeadTransfer({ memberId, companyId, companyName }: { memberId: number; companyId: number; companyName: string }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [reload, setReload] = useState(0)
  const { toast } = useToast()
  useEffect(() => {
    let cancelled = false
    setLoading(true); setPreview(null); setError(''); setTarget(''); setConfirming(false)
    usuariosApi.leadTransferPreview(memberId).then(response => {
      if (cancelled) return
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Não foi possível consultar os leads.')
      if (response.data.companyId !== companyId) throw new Error('A clínica ativa mudou. Reabra o membro da equipe.')
      setPreview(response.data)
    }).catch(error => { if (!cancelled) setError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [memberId, companyId, reload])

  const transfer = async () => {
    if (!preview || !target || saving) return
    setSaving(true); setError('')
    try {
      const response = await usuariosApi.transferLeads(memberId, Number(target), preview.total, preview.companyId)
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Não foi possível transferir os leads.')
      toast({ title: 'Leads transferidos', description: `${response.data.transferred} lead(s) atribuídos a ${preview.targets.find(m => String(m.id) === target)?.name}.` })
      setReload(value => value + 1)
    } catch (error: any) {
      setError(error.message); setConfirming(false)
    } finally { setSaving(false) }
  }

  return <section className="space-y-3" aria-labelledby={`transfer-title-${memberId}`} aria-busy={loading || saving}>
    <div>
      <h4 id={`transfer-title-${memberId}`} className="text-sm font-semibold">Transferir leads deste membro</h4>
      <p className="mt-1 text-sm text-muted-foreground">Transfira as responsabilidades atuais em {companyName}. O membro continua na equipe.</p>
    </div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Consultando leads…</p> : <>
      {preview && <p className="text-sm">
        <strong>{preview.total} lead(s)</strong> atribuídos a este membro.
        {preview.total > 0 && <span className="block text-muted-foreground">SDR: {preview.counts.sdrId} · Closer: {preview.counts.closerId} · Especialista: {preview.counts.especialistaId}. Um lead pode ter mais de uma função.</span>}
      </p>}
      {preview && preview.total > 0 && <>
        {preview.targets.length ? <div className="space-y-2 max-w-lg">
          <Label htmlFor={`transfer-target-${memberId}`}>Atribuir todos os leads para</Label>
          <Select value={target} onValueChange={value => { setTarget(value); setConfirming(false) }} disabled={saving}>
            <SelectTrigger id={`transfer-target-${memberId}`}><SelectValue placeholder="Selecione o novo responsável">{preview.targets.find(member => String(member.id) === target)?.name}</SelectValue></SelectTrigger>
            <SelectContent>{preview.targets.map(member => <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">A lista inclui membros ativos com as funções necessárias nesta clínica. Propostas, vendas e comissões anteriores mantêm seus responsáveis históricos.</p>
          {confirming ? <div className="space-y-3 pt-2">
            <p className="text-sm">Confirmar a transferência de <strong>{preview.total} lead(s)</strong> para <strong>{preview.targets.find(member => String(member.id) === target)?.name}</strong>? As conversas desses leads atribuídas ao membro também serão transferidas.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={transfer} disabled={saving}>{saving ? 'Transferindo…' : 'Confirmar transferência'}</Button>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={saving}>Cancelar</Button>
            </div>
          </div> : <Button type="button" onClick={() => setConfirming(true)} disabled={!target}>Transferir leads</Button>}
        </div> : <p className="text-sm text-muted-foreground">Nenhum membro disponível com as funções necessárias. Ative ou ajuste o cargo de outro membro nesta clínica para receber os leads.</p>}
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" variant="link" className="h-auto p-0" disabled={saving} onClick={() => setReload(value => value + 1)}>Atualizar prévia</Button>
    </>}
  </section>
}
