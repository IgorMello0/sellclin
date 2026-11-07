import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'

export interface DashboardOption {
  value: string
  label: string
}

export function DashboardSelect({ id, label, value, groups, onChange, disabled }: {
  id: string
  label: string
  value: string
  groups: { label?: string; options: DashboardOption[] }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const selected = groups.flatMap(group => group.options).find(option => option.value === value)

  return (
    <div className="min-w-0">
      <label id={id + '-label'} htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      <Select.Root value={value} onValueChange={next => { if (next !== null) onChange(next) }} disabled={disabled} modal={false}>
        <Select.Trigger id={id} aria-labelledby={id + '-label'}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm font-medium text-primary outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60">
          <Select.Value className="truncate">{selected?.label ?? 'Selecione'}</Select.Value>
          <Select.Icon><ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} className="z-50">
            <Select.Popup className="w-[var(--anchor-width)] min-w-0 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
              <Select.List className="max-h-[min(22rem,calc(var(--available-height)-12px))] overflow-y-auto overscroll-contain">
                {groups.map((group, index) => (
                  <Select.Group key={group.label ?? index} className="not-first:border-t not-first:pt-1">
                    {group.label && <Select.GroupLabel className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{group.label}</Select.GroupLabel>}
                    {group.options.map(option => (
                      <Select.Item key={option.value} value={option.value}
                        className="flex cursor-default items-center justify-between gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/5 data-[selected]:font-semibold data-[selected]:text-primary data-[selected]:data-[highlighted]:bg-primary/10">
                        <Select.ItemText className="min-w-0 break-words">{option.label}</Select.ItemText>
                        <Select.ItemIndicator className="shrink-0"><Check className="size-4" aria-hidden="true" /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Group>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
