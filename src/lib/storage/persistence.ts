import {
  DEFAULT_SETTINGS,
  SAVE_VERSION,
  emptySave,
  type Profile,
  type ProfileSave,
  type Settings,
} from './schema'

/** localStorage keys. Device-only values (token, gist) are never part of a save or a sync. */
export const KEYS = {
  profiles: 'flash:profiles',
  current: 'flash:current',
  save: (id: string) => `flash:save:${id}`,
  token: 'flash:token',
  gist: 'flash:gist',
  deckRepo: 'flash:deck-repo',
  lastSync: 'flash:last-sync',
} as const

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Make anything that looks like a save into a valid one, keeping what's usable. */
export function migrate(raw: unknown, profileId: string): ProfileSave {
  const save = emptySave(profileId)
  if (!isObject(raw)) return save
  if (typeof raw.version === 'number' && raw.version > SAVE_VERSION)
    console.warn('Progress was saved by a newer version of Flash')
  if (isObject(raw.settings)) save.settings = sanitizeSettings(raw.settings)
  if (typeof raw.settingsUpdatedAt === 'number') save.settingsUpdatedAt = raw.settingsUpdatedAt
  if (isObject(raw.decks)) {
    for (const [id, d] of Object.entries(raw.decks)) {
      if (!isObject(d) || !isObject(d.items)) continue
      save.decks[id] = {
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
        items: d.items as ProfileSave['decks'][string]['items'],
        ...(Array.isArray(d.templates) ? { templates: d.templates.map(String) } : {}),
        ...(typeof d.testDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.testDate)
          ? { testDate: d.testDate }
          : {}),
      }
    }
  }
  if (Array.isArray(raw.log))
    save.log = raw.log.filter((e) => isObject(e) && typeof e.t === 'number') as ProfileSave['log']
  if (Array.isArray(raw.sprints))
    save.sprints = raw.sprints.filter(isObject) as unknown as ProfileSave['sprints']
  if (Array.isArray(raw.races))
    save.races = raw.races.filter(isObject) as unknown as ProfileSave['races']
  return save
}

export function sanitizeSettings(raw: Record<string, unknown>): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS }
  const pick = <K extends keyof Settings>(key: K, valid: (v: unknown) => boolean) => {
    if (valid(raw[key])) s[key] = raw[key] as Settings[K]
  }
  const oneOf =
    (...options: unknown[]) =>
    (v: unknown) =>
      options.includes(v)
  const between = (lo: number, hi: number) => (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
  pick('language', oneOf('nl', 'en'))
  pick('voice', oneOf('female', 'male', 'random'))
  pick('autoplay', (v) => typeof v === 'boolean')
  pick('sounds', (v) => typeof v === 'boolean')
  pick('theme', oneOf('system', 'light', 'dark'))
  pick('dailyGoal', between(5, 500))
  pick('newPerDay', between(0, 100))
  pick('sessionSize', between(5, 200))
  pick('answerStyle', oneOf('auto', 'type', 'choose', 'flip'))
  return s
}

export function migrateProfiles(raw: unknown): Profile[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (p): p is Profile => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string',
    )
    .map((p) =>
      // Removed profiles from before tombstones were stripped: forget who they were.
      p.deletedAt ? { ...p, name: '', avatar: '', color: '' } : p,
    )
}

function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text ? JSON.parse(text) : undefined
  } catch {
    return undefined
  }
}

export function loadProfiles(): Profile[] {
  return migrateProfiles(read(KEYS.profiles))
}

export function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(KEYS.profiles, JSON.stringify(profiles))
}

export function loadSave(profileId: string): ProfileSave {
  return migrate(read(KEYS.save(profileId)), profileId)
}

export function storeSave(save: ProfileSave): void {
  localStorage.setItem(KEYS.save(save.profileId), JSON.stringify(save))
}

export function removeSave(profileId: string): void {
  localStorage.removeItem(KEYS.save(profileId))
}

export function newId(length = 10): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}

/** Ask the browser not to clear our storage when space runs low (Safari especially). */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Not supported: nothing to do.
  }
}
