import { AudioEngine } from '../lib/audio/engine'
import {
  KEYS,
  loadProfiles,
  loadSave,
  newId,
  removeSave,
  requestPersistence,
  saveProfiles,
  storeSave,
} from '../lib/storage/persistence'
import { emptySave, type Profile, type ProfileSave, type Settings } from '../lib/storage/schema'

/**
 * The profiles on this device and the current learner's progress. Changes are saved to
 * localStorage automatically (see startPersistence).
 */
export const app = $state<{ profiles: Profile[]; save: ProfileSave | undefined }>({
  profiles: [],
  save: undefined,
})

export const audio = new AudioEngine()

export function visibleProfiles(): Profile[] {
  return app.profiles.filter((p) => !p.deletedAt)
}

export function currentProfile(): Profile | undefined {
  return app.profiles.find((p) => p.id === app.save?.profileId && !p.deletedAt)
}

/** The current learner's progress. Only call this on pages that need a profile. */
export function save(): ProfileSave {
  if (!app.save) throw new Error('no profile selected')
  return app.save
}

export function settings(): Settings | undefined {
  return app.save?.settings
}

export function initApp(): void {
  app.profiles = loadProfiles()
  const id = localStorage.getItem(KEYS.current)
  const profile = visibleProfiles().find((p) => p.id === id) ?? visibleProfiles()[0]
  app.save = profile ? loadSave(profile.id) : undefined
}

export function selectProfile(id: string): void {
  flush()
  app.save = loadSave(id)
  localStorage.setItem(KEYS.current, id)
}

export function createProfile(name: string, avatar: string, color: string, select = true): Profile {
  const now = Date.now()
  const profile: Profile = {
    id: newId(8),
    name: name.trim(),
    avatar,
    color,
    createdAt: now,
    updatedAt: now,
  }
  app.profiles = [...app.profiles, profile]
  saveProfiles($state.snapshot(app.profiles) as Profile[])
  storeSave(emptySave(profile.id))
  if (select || !app.save) selectProfile(profile.id)
  return profile
}

export function updateProfile(
  id: string,
  changes: Partial<Pick<Profile, 'name' | 'avatar' | 'color'>>,
): void {
  app.profiles = app.profiles.map((p) =>
    p.id === id ? { ...p, ...changes, updatedAt: Date.now() } : p,
  )
  saveProfiles($state.snapshot(app.profiles) as Profile[])
}

export function deleteProfile(id: string): void {
  const now = Date.now()
  app.profiles = app.profiles.map((p) =>
    p.id === id ? { ...p, deletedAt: now, updatedAt: now } : p,
  )
  saveProfiles($state.snapshot(app.profiles) as Profile[])
  removeSave(id)
  if (app.save?.profileId === id) {
    const next = visibleProfiles()[0]
    app.save = next ? loadSave(next.id) : undefined
    if (next) localStorage.setItem(KEYS.current, next.id)
    else localStorage.removeItem(KEYS.current)
  }
}

/** Replace the profiles and the stored saves (after a sync or a restore). */
export function replaceFamily(profiles: Profile[], saves: Record<string, ProfileSave>): void {
  saveProfiles(profiles)
  for (const s of Object.values(saves)) storeSave(s)
  app.profiles = profiles
  const id = app.save?.profileId
  if (id && saves[id]) app.save = saves[id]
  else if (!currentProfile()) {
    const next = visibleProfiles()[0]
    app.save = next ? loadSave(next.id) : undefined
  }
}

export function updateSettings(changes: Partial<Settings>): void {
  const s = save()
  Object.assign(s.settings, changes)
  s.settingsUpdatedAt = Date.now()
}

let unsaved: ProfileSave | undefined

function flush(): void {
  if (!unsaved) return
  try {
    storeSave(unsaved)
    unsaved = undefined
  } catch (err) {
    console.error('Could not save progress', err)
  }
}

/** Save progress shortly after every change, and right away when the app is hidden. */
export function startPersistence(): () => void {
  const stop = $effect.root(() => {
    $effect(() => {
      if (!app.save) return
      unsaved = $state.snapshot(app.save) as ProfileSave
      const handle = setTimeout(flush, 300)
      return () => clearTimeout(handle)
    })
    $effect(() => {
      audio.sounds = app.save?.settings.sounds ?? true
    })
    $effect(() => {
      const theme = app.save?.settings.theme ?? 'system'
      document.documentElement.dataset.theme = theme
    })
    $effect(() => {
      document.documentElement.lang = app.save?.settings.language ?? 'nl'
    })
  })
  const onHide = () => flush()
  const onVisibility = () => document.visibilityState === 'hidden' && flush()
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onVisibility)
  const unlock = () => audio.unlock()
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const
  for (const type of gestures)
    window.addEventListener(type, unlock, { capture: true, passive: true })
  void requestPersistence()
  return () => {
    stop()
    flush()
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onVisibility)
    for (const type of gestures) window.removeEventListener(type, unlock, { capture: true })
  }
}

/** Write pending changes now (before a sync reads localStorage). */
export function flushSave(): void {
  flush()
}
