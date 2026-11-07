import { useQuery } from '@tanstack/react-query'
import { LeadDetailsModal } from '@/components/LeadDetailsModal'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FUNNELS, STAGES } from '@/config/funnelConfig'
import { useAuth } from '@/contexts/AuthContext'
import { funnelConfigApi, leadsApi } from '@/lib/api'

const defaultFunnels = FUNNELS.map(funnel => ({ ...funnel, stages: STAGES[funnel.id] ?? [] }))

export default function DashboardLeadRecord({ id, onClose, onUpdate }: { id: number; onClose: () => void; onUpdate: () => void }) {
  const { professional } = useAuth()
  const lead = useQuery({
    queryKey: ['dashboard-lead-record', professional?.id, professional?.companyId, id],
    queryFn: async () => {
      const response = await leadsApi.getById(id)
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Não foi possível abrir o lead.')
      return response.data
    },
    retry: false,
  })
  const funnels = useQuery({
    queryKey: ['dashboard-lead-funnels', professional?.id, professional?.companyId],
    queryFn: async () => {
      const response = await funnelConfigApi.getAll()
      return response.success ? response.data : undefined
    },
  })
  const stages = funnels.data?.length ? funnels.data : defaultFunnels
  if (!lead.data) {
    return (
      <Dialog open onOpenChange={open => { if (!open) onClose() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registro do lead</DialogTitle></DialogHeader>
          {lead.isError ? <div role="alert" className="space-y-3">
            <p className="text-sm">{lead.error.message}</p>
            <Button size="sm" variant="outline" onClick={() => void lead.refetch()}>Tentar novamente</Button>
          </div> : <p role="status" className="text-sm">Carregando lead…</p>}
        </DialogContent>
      </Dialog>
    )
  }
  return <LeadDetailsModal lead={lead.data} isOpen onClose={onClose} onUpdate={() => {
    void lead.refetch()
    onUpdate()
  }} funnels={stages} allStages={stages.flatMap(funnel => funnel.stages ?? [])} />
}
