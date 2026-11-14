import { useState } from 'react';
import { addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CalendarTask = {
  id: number;
  title: string;
  dueDate: string;
  scheduledAt?: string | null;
  label?: string | null;
  color?: string | null;
  status: string;
  assignedTo?: { name: string } | null;
};

const weekOptions = { weekStartsOn: 1 } as const;
const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
const taskDate = (task: CalendarTask) => new Date(task.scheduledAt || task.dueDate);

export function TaskCalendar<T extends CalendarTask>({ tasks, loading, showAssignee, onOpen, onCreate }: {
  tasks: T[];
  loading: boolean;
  showAssignee: boolean;
  onOpen: (task: T) => void;
  onCreate?: (day: Date) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const month = mode === 'month';
  const start = startOfWeek(month ? startOfMonth(anchor) : anchor, weekOptions);
  const end = endOfWeek(month ? endOfMonth(anchor) : anchor, weekOptions);
  const days = eachDayOfInterval({ start, end });
  const tasksByDay = new Map<string, T[]>();

  for (const task of tasks) {
    const key = dateKey(taskDate(task));
    const dayTasks = tasksByDay.get(key) ?? [];
    dayTasks.push(task);
    tasksByDay.set(key, dayTasks);
  }
  for (const dayTasks of tasksByDay.values()) {
    dayTasks.sort((a, b) => Number(Boolean(a.scheduledAt)) - Number(Boolean(b.scheduledAt)) || taskDate(a).getTime() - taskDate(b).getTime());
  }

  const move = (direction: number) => setAnchor((date) => month ? addMonths(date, direction) : addWeeks(date, direction));
  const period = month
    ? format(anchor, "MMMM 'de' yyyy", { locale: ptBR })
    : format(start, 'dd/MM') + ' a ' + format(end, 'dd/MM/yyyy');

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Calendário de tarefas" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => move(-1)} aria-label="Período anterior"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => move(1)} aria-label="Próximo período"><ChevronRight /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Hoje</Button>
          <h2 aria-live="polite" className="ml-1 text-sm font-semibold capitalize">{period}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={month ? 'ghost' : 'outline'} size="sm" aria-pressed={!month} onClick={() => setMode('week')}>Semana</Button>
          <Button variant={month ? 'outline' : 'ghost'} size="sm" aria-pressed={month} onClick={() => setMode('month')}>Mês</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className={cn('grid gap-px bg-border', month ? 'min-w-[720px] grid-cols-7' : 'grid-cols-1 md:grid-cols-7')}>
          {days.map((day) => {
            const key = dateKey(day);
            const today = isToday(day);
            const dayTasks = tasksByDay.get(key) ?? [];
            const dayLabel = format(day, "EEEE, d 'de' MMMM", { locale: ptBR });
            return (
              <div key={key} className={cn('min-w-0 bg-card p-2', month ? 'min-h-28' : 'min-h-20 md:min-h-60', month && !isSameMonth(day, anchor) && 'bg-muted/40')}>
                <div className="mb-2 flex items-center justify-between gap-1">
                  <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-medium capitalize text-muted-foreground" aria-label={dayLabel}>
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-md tabular-nums', today && 'bg-primary font-semibold text-primary-foreground')}>{format(day, 'd')}</span>
                    <span className="truncate">{format(day, 'EEE', { locale: ptBR })}</span>
                  </h3>
                  {onCreate && <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" onClick={() => onCreate(day)} aria-label={'Criar tarefa para ' + dayLabel}><Plus /></Button>}
                </div>
                <ul className="space-y-1.5">
                  {dayTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(task)}
                        className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-left hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={task.color ? {
                          backgroundColor: `color-mix(in srgb, ${task.color} 13%, var(--color-background))`,
                          borderColor: `color-mix(in srgb, ${task.color} 42%, var(--color-border))`,
                        } : undefined}
                      >
                        <span className={cn('block break-words text-xs font-semibold leading-snug', task.status === 'completed' && 'text-muted-foreground line-through')}>{task.title}</span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                          {task.scheduledAt ? format(taskDate(task), 'HH:mm') + ' · Vence ' + format(new Date(task.dueDate), 'dd/MM') : 'Prazo · ' + format(taskDate(task), 'HH:mm')}
                        </span>
                        {task.label && <span className="mt-1 block truncate text-[11px] font-medium text-primary" title={task.label}>{task.label}</span>}
                        {showAssignee && task.assignedTo && <span className="mt-1 block truncate text-[11px] text-muted-foreground" title={task.assignedTo.name}>{task.assignedTo.name}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
