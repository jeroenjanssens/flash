import type { Family } from './gist'
import { mergeSaves } from './merge'
import { migrate, migrateProfiles } from './persistence'
import type { Profile, ProfileSave } from './schema'

/** One learner in a file: who they are (name, animal, colour) and all of their progress. */
export interface ProfileFile {
  app: 'flash'
  kind: 'profile'
  version: 1
  exportedAt: number
  profile: Profile
  save: ProfileSave
}

export function profileFile(profile: Profile, save: ProfileSave, now: number): ProfileFile {
  const rest = { ...profile }
  delete rest.deletedAt
  return { app: 'flash', kind: 'profile', version: 1, exportedAt: now, profile: rest, save }
}

/** A file name like `flash-florien-2026-11-03.json`. */
export function profileFileName(profile: Profile, now: number): string {
  const name =
    profile.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'profile'
  return `flash-${name}-${new Date(now).toISOString().slice(0, 10)}.json`
}

/** The profile and progress in an exported file, or undefined if it isn't one. */
export function readProfileFile(raw: unknown): { profile: Profile; save: ProfileSave } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  if (r.app !== 'flash' || r.kind !== 'profile') return undefined
  const [profile] = migrateProfiles([r.profile])
  if (!profile?.name) return undefined
  return { profile, save: migrate(r.save, profile.id) }
}

/**
 * Add an exported profile to the family. If it's here already, the progress is merged; if it
 * was removed (or never here), it comes back as it was in the file. It gets a new `updatedAt`,
 * so a removal synced from another device doesn't remove it again.
 */
export function addProfile(
  family: Family,
  incoming: { profile: Profile; save: ProfileSave },
  now: number,
): { family: Family; kind: 'added' | 'merged' } {
  const id = incoming.profile.id
  const existing = family.profiles.find((p) => p.id === id)
  const saves = { ...family.saves }
  if (existing && !existing.deletedAt) {
    saves[id] = saves[id] ? mergeSaves(saves[id], incoming.save) : incoming.save
    return { family: { profiles: family.profiles, saves }, kind: 'merged' }
  }
  const profile: Profile = { ...incoming.profile, updatedAt: now }
  delete profile.deletedAt
  const profiles = existing
    ? family.profiles.map((p) => (p.id === id ? profile : p))
    : [...family.profiles, profile]
  saves[id] = incoming.save
  return { family: { profiles, saves }, kind: 'added' }
}

/** What's kept of a removed profile: only enough to sync the removal, not who it was. */
export function tombstone(profile: Profile, now: number): Profile {
  return {
    id: profile.id,
    name: '',
    avatar: '',
    color: '',
    createdAt: profile.createdAt,
    updatedAt: now,
    deletedAt: now,
  }
}
