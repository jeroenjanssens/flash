import { GitHub, GitHubError } from '../lib/github'
import { GistClient, mergeFamily, syncFamily, type Family } from '../lib/storage/gist'
import { KEYS, loadProfiles, loadSave } from '../lib/storage/persistence'
import type { ProfileSave } from '../lib/storage/schema'
import { app, flushSave, replaceFamily } from './app.svelte'
import { refreshLibrary } from './decks.svelte'
import { session } from './ui.svelte'

export const sync = $state({
  connected: typeof localStorage !== 'undefined' && !!localStorage.getItem(KEYS.token),
  syncing: false,
  lastSync: Number(
    typeof localStorage !== 'undefined' ? (localStorage.getItem(KEYS.lastSync) ?? 0) : 0,
  ),
  error: '' as '' | GitHubError['code'],
})

function localFamily(): Family {
  flushSave()
  const profiles = loadProfiles()
  const saves: Record<string, ProfileSave> = {}
  for (const p of profiles) if (!p.deletedAt) saves[p.id] = loadSave(p.id)
  return { profiles, saves }
}

/** Sync progress with the family gist. Returns whether it worked. */
export async function syncNow(): Promise<boolean> {
  const token = localStorage.getItem(KEYS.token)
  if (!token || sync.syncing) return false
  sync.syncing = true
  sync.error = ''
  try {
    const before = localFamily()
    const result = await syncFamily(
      before,
      new GistClient(new GitHub(token)),
      localStorage.getItem(KEYS.gist) ?? undefined,
    )
    // Keep anything that changed here while the sync was running.
    const merged = mergeFamily(localFamily(), result.family)
    replaceFamily(merged.profiles, merged.saves)
    localStorage.setItem(KEYS.gist, result.gistId)
    sync.lastSync = Date.now()
    localStorage.setItem(KEYS.lastSync, String(sync.lastSync))
    return true
  } catch (err) {
    sync.error = err instanceof GitHubError ? err.code : 'http'
    return false
  } finally {
    sync.syncing = false
  }
}

/** Connect this device with a token (and optionally a known gist and deck library). */
export async function connect(token: string, gistId?: string, deckRepo?: string): Promise<boolean> {
  localStorage.setItem(KEYS.token, token.trim())
  if (gistId) localStorage.setItem(KEYS.gist, gistId)
  if (deckRepo) localStorage.setItem(KEYS.deckRepo, deckRepo)
  sync.connected = true
  const ok = await syncNow()
  if (!ok) {
    disconnect(false)
    return false
  }
  void refreshLibrary().catch(() => {})
  return true
}

export function disconnect(clearError = true): void {
  localStorage.removeItem(KEYS.token)
  localStorage.removeItem(KEYS.gist)
  localStorage.removeItem(KEYS.lastSync)
  sync.connected = false
  sync.lastSync = 0
  if (clearError) sync.error = ''
}

/** A link that sets up another device: token, gist and deck library, in the URL fragment. */
export function pairingLink(): string | undefined {
  const token = localStorage.getItem(KEYS.token)
  if (!token) return undefined
  const params = new URLSearchParams({ t: token })
  const gist = localStorage.getItem(KEYS.gist)
  const repo = localStorage.getItem(KEYS.deckRepo)
  if (gist) params.set('g', gist)
  if (repo) params.set('r', repo)
  return `${location.origin}${location.pathname}#/pair?${params}`
}

/**
 * Sync on start, when a session ends, when the app goes to the background and when it comes
 * back. The deck library is checked on start too.
 */
export function startSync(): () => void {
  if (sync.connected) {
    void syncNow()
    void refreshLibrary().catch(() => {})
  }
  let wasActive = false
  const stop = $effect.root(() => {
    $effect(() => {
      const active = session.active
      if (wasActive && !active && sync.connected) void syncNow()
      wasActive = active
    })
  })
  const onVisibility = () => {
    if (!sync.connected) return
    if (document.visibilityState === 'hidden' || !session.active) void syncNow()
  }
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/** For the parent overview: everyone's progress on this device. */
export function familySaves(): Record<string, ProfileSave> {
  const out: Record<string, ProfileSave> = {}
  for (const p of app.profiles)
    if (!p.deletedAt) out[p.id] = p.id === app.save?.profileId ? app.save : loadSave(p.id)
  return out
}
