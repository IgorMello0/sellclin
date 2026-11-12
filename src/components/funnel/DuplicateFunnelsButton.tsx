import { useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { funnelConfigApi } from '@/lib/api'
import { type OriginalFunnelCode } from '../../../server/utils/funnel-stages'

const templates: { code: OriginalFunnelCode; label: string }[] = [
  { code: 'prospecting', label: 'Prospecção' },
  { code: 'commercial', label: 'Comercial' },
  { code: 'sales', label: 'Vendas' },
]

export function DuplicateFunnelsButton({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [operationName, setOperationName] = useState('')
  const [selected, setSelected] = useState<OriginalFunnelCode[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const duplicate = async () => {
    if (saving || !operationName.trim() || !selected.length) return
    setSaving(true)
    setError('')
    try {
      const result = await funnelConfigApi.duplicate({ operationName: operationName.trim(), templates: selected })
      if (!result.success) throw new Error(result.error?.message || 'Não foi possível duplicar os funis.')
      const count = result.data?.length || 0
      toast({ title: count === 1 ? 'Funil duplicado' : 'Funis duplicados' })
      setOpen(false)
      setOperationName('')
      setSelected([])
      onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível duplicar os funis.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-10 px-3" onClick={() => { setError(''); setOpen(true) }}>
        <Copy className="h-4 w-4" />
        Duplicar funil
      </Button>
      <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicar funis originais</DialogTitle>
            <DialogDescription>As cópias começam vazias e herdam as etapas e suas funções.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); void duplicate() }}>
            <div className="space-y-2">
              <Label htmlFor="funnel-operation-name">Nome da operação</Label>
              <Input id="funnel-operation-name" placeholder="Ex.: Social Selling" value={operationName}
                maxLength={60} onChange={event => setOperationName(event.target.value)} disabled={saving} required />
              <p className="text-xs text-muted-foreground">Use o mesmo nome para adicionar outros funis à operação.</p>
            </div>
            <fieldset className="space-y-2" disabled={saving}>
              <legend className="mb-2 text-sm font-medium">Funis para copiar</legend>
              {templates.map(({ code, label }) => (
                <label key={code} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.includes(code)}
                    onChange={event => {
                      const checked = event.target.checked
                      setSelected(current => checked ? [...current, code] : current.filter(value => value !== code))
                    }} />
                  {label}
                </label>
              ))}
            </fieldset>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !operationName.trim() || !selected.length}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Duplicar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
