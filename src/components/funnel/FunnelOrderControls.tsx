import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { funnelConfigApi } from '@/lib/api'

type Direction = -1 | 1

export function useFunnelOrder<T extends { id: number; order: number }>(
  funnels: T[], setFunnels: Dispatch<SetStateAction<T[]>>, onSaved?: () => void,
) {
  const { toast } = useToast()
  const inFlight = useRef(false)
  const [isReordering, setIsReordering] = useState(false)

  async function moveFunnel(id: number, direction: Direction) {
    const index = funnels.findIndex(funnel => funnel.id === id)
    const target = index + direction
    if (inFlight.current || index < 0 || target < 0 || target >= funnels.length) return

    const reordered = [...funnels]
    reordered[index] = funnels[target]
    reordered[target] = funnels[index]
    const positions = reordered.map((funnel, order) => ({ id: funnel.id, order }))
    const orderById = new Map(positions.map(({ id, order }) => [id, order]))
    inFlight.current = true
    setIsReordering(true)
    try {
      const response = await funnelConfigApi.reorder(positions)
      if (!response.success) throw new Error(response.error?.message || 'Não foi possível salvar a ordem dos funis.')
      setFunnels(current => current
        .map(funnel => ({ ...funnel, order: orderById.get(funnel.id) ?? funnel.order }))
        .sort((first, second) => first.order - second.order || first.id - second.id))
      toast({ title: 'Ordem dos funis salva' })
      onSaved?.()
    } catch (error) {
      toast({
        title: 'Erro ao reordenar os funis',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      inFlight.current = false
      setIsReordering(false)
    }
  }

  return { isReordering, moveFunnel }
}

export function FunnelOrderControls({ label, index, count, disabled, onMove }: {
  label: string
  index: number
  count: number
  disabled: boolean
  onMove: (direction: Direction) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`Ordem de ${label}`}>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500"
        title="Subir funil" aria-label={`Subir funil ${label}`} disabled={disabled || index === 0}
        onClick={event => { event.stopPropagation(); onMove(-1) }}>
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500"
        title="Descer funil" aria-label={`Descer funil ${label}`} disabled={disabled || index === count - 1}
        onClick={event => { event.stopPropagation(); onMove(1) }}>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}
