export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

export const toasts = $state<{ list: Toast[] }>({ list: [] })
let next = 0

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500): void {
  const id = ++next
  toasts.list = [...toasts.list, { id, text, kind }]
  if (ms > 0) setTimeout(() => dismiss(id), ms)
}

export function dismiss(id: number): void {
  toasts.list = toasts.list.filter((t) => t.id !== id)
}

/** Whether a study session is running (sync waits until it's over). */
export const session = $state({ active: false })
