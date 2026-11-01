/** Service worker registration (offline use and updates). */

export async function registerPwa(handlers: {
  onNeedRefresh: (update: () => Promise<void>) => void
  onOfflineReady: () => void
}): Promise<void> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const { registerSW } = await import('virtual:pwa-register')
  const updateSW = registerSW({
    onNeedRefresh: () => handlers.onNeedRefresh(() => updateSW(true)),
    onOfflineReady: handlers.onOfflineReady,
  })
}

export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}
