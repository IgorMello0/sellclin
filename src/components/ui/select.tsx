import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// Select implementation without Radix
interface SelectContextType {
  disabled?: boolean
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}
const SelectContext = React.createContext<SelectContextType>({ value: "", onValueChange: () => {}, open: false, setOpen: () => {} })

const Select = ({ value: controlledValue, defaultValue, onValueChange, children, disabled = false }: { disabled?: boolean; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const [open, setOpen] = React.useState(false)
  const value = controlledValue ?? internalValue
  const setValue = onValueChange ?? setInternalValue
  return <SelectContext.Provider value={{ value, onValueChange: setValue, open, setOpen, disabled }}>{children}</SelectContext.Provider>
}

const SelectGroup = ({ children }: { children: React.ReactNode }) => <div role="group">{children}</div>

const SelectValue = ({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) => {
  const { value } = React.useContext(SelectContext)
  return <span>{children || value || placeholder}</span>
}

const SelectTrigger = ({ className, children, ref, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { open, setOpen, disabled } = React.useContext(SelectContext)
  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  )
}
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = ({ className, children, position = "popper", ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { position?: string; sideOffset?: number; ref?: React.Ref<HTMLDivElement> }) => {
  const { open, setOpen } = React.useContext(SelectContext)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0, maxHeight: 300, transform: 'none' })

  const calculatePosition = (trigger: HTMLButtonElement) => {
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 10
    const spaceAbove = rect.top - 10
    
    if (spaceBelow < 250 && spaceAbove > spaceBelow) {
      return { top: rect.top - 4, left: rect.left, width: rect.width, transform: 'translateY(-100%)', maxHeight: spaceAbove }
    } else {
      return { top: rect.bottom + 4, left: rect.left, width: rect.width, transform: 'none', maxHeight: spaceBelow }
    }
  }

  React.useEffect(() => {
    if (!open) return
    // Find the trigger button (parent combobox) to anchor below it
    const trigger = document.querySelector('[role="combobox"][aria-expanded="true"]') as HTMLButtonElement
    if (trigger) {
      triggerRef.current = trigger
      setCoords(calculatePosition(trigger))
    }

    // Recalculate on scroll (handles scrollable containers like Sheet)
    const updatePosition = () => {
      if (triggerRef.current) {
        setCoords(calculatePosition(triggerRef.current))
      }
    }

    const handleClick = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleEsc)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleEsc)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, setOpen])

  if (!open) return null

  return createPortal(
    <div
      ref={(node) => {
        (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className={cn(
        "select-content fixed z-[9999] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
      style={{ top: coords.top, left: coords.left, width: coords.width, maxHeight: coords.maxHeight, transform: coords.transform }}
      {...props}
    >
      <div className="p-1">{children}</div>
    </div>,
    document.body
  )
}
SelectContent.displayName = "SelectContent"

const SelectLabel = ({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
)

const SelectItem = ({ className, children, value, disabled = false, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean; ref?: React.Ref<HTMLDivElement> }) => {
  const ctx = React.useContext(SelectContext)
  const isSelected = ctx.value === value
  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      data-state={isSelected ? "checked" : "unchecked"}
      onClick={() => { if (!disabled && !ctx.disabled) { ctx.onValueChange(value); ctx.setOpen(false) } }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isSelected && "bg-accent/50",
        className
      )}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
      )}
      <span>{children}</span>
    </div>
  )
}
SelectItem.displayName = "SelectItem"

const SelectSeparator = ({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
)

const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
