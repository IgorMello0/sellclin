// use-toast hook - simplified version without Radix Toast dependency
import * as React from "react"

type ToastVariant = "default" | "destructive" | "success"

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastState {
  toasts: Toast[]
}

let listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }
const MAX_VISIBLE_TOASTS = 3

function sameToast(left: Toast, right: Omit<Toast, "id">) {
  return left.title === right.title
    && left.description === right.description
    && left.variant === right.variant
}

function dispatch(toast: Omit<Toast, "id">) {
  // Repeated polling errors should update the page state, not fill the screen.
  if (memoryState.toasts.some((current) => sameToast(current, toast))) return

  const id = Math.random().toString(36).slice(2)
  const newToast = { ...toast, id }
  memoryState = {
    toasts: [...memoryState.toasts.slice(-(MAX_VISIBLE_TOASTS - 1)), newToast],
  }
  listeners.forEach((l) => l(memoryState))
  // Default to 5 seconds; callers can override the display duration.
  setTimeout(() => {
    memoryState = { toasts: memoryState.toasts.filter((t) => t.id !== id) }
    listeners.forEach((l) => l(memoryState))
  }, toast.duration ?? 5000)
}

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      listeners = listeners.filter((l) => l !== setState)
    }
  }, [])

  const toast = React.useCallback((props: Omit<Toast, "id">) => dispatch(props), [])
  const dismiss = React.useCallback((toastId?: string) => {
    memoryState = {
      toasts: toastId
        ? memoryState.toasts.filter((current) => current.id !== toastId)
        : [],
    }
    listeners.forEach((listener) => listener(memoryState))
  }, [])

  return {
    ...state,
    toast,
    dismiss,
  }
}

export { useToast, dispatch as toast, type Toast }
