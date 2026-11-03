import { describe, expect, it } from 'vitest'
import { mergeFamily } from '../../src/lib/storage/gist'
import { migrateProfiles } from '../../src/lib/storage/persistence'
import {
  addProfile,
  profileFile,
  profileFileName,
  readProfileFile,
  tombstone,
} from '../../src/lib/storage/profileFile'
import { emptySave, type Profile } from '../../src/lib/storage/schema'

const NOW = new Date(2026, 10, 3, 16, 0).getTime()
const florien: Profile = {
  id: 'f1',
  name: 'Florien',
  avatar: '🦊',
  color: '#ff6b4a',
  createdAt: 1,
  updatedAt: 2,
}
const withProgress = (id: string, t: number) => {
  const s = emptySave(id)
  s.log.push({
    t,
    deck: 'd',
    card: 'c',
    template: 'x',
    mode: 'learn',
    method: 'type',
    correct: true,
    hints: 0,
    ms: 1,
  })
  return s
}

describe('profile files', () => {
  it('round-trips a profile with its progress', () => {
    const file = JSON.parse(JSON.stringify(profileFile(florien, withProgress('f1', 5), NOW)))
    const back = readProfileFile(file)!
    expect(back.profile).toEqual(florien)
    expect(back.save.log).toHaveLength(1)
    expect(readProfileFile({ app: 'flash', profiles: [] })).toBeUndefined()
    expect(profileFileName({ ...florien, name: 'Zoë B.' }, NOW)).toBe('flash-zoe-b-2026-11-03.json')
  })

  it('merges progress into a profile that is still here', () => {
    const family = { profiles: [florien], saves: { f1: withProgress('f1', 5) } }
    const r = addProfile(family, { profile: florien, save: withProgress('f1', 9) }, NOW)
    expect(r.kind).toBe('merged')
    expect(r.family.saves.f1.log.map((e) => e.t)).toEqual([5, 9])
  })

  it('brings a removed profile back, and the removal elsewhere does not win', () => {
    const removed = tombstone(florien, NOW - 1000)
    const r = addProfile(
      { profiles: [removed], saves: {} },
      { profile: florien, save: withProgress('f1', 5) },
      NOW,
    )
    expect(r.kind).toBe('added')
    expect(r.family.profiles).toEqual([{ ...florien, updatedAt: NOW }])
    // Another device still has the removal.
    const synced = mergeFamily(r.family, { profiles: [removed], saves: {} })
    expect(synced.profiles[0].deletedAt).toBeUndefined()
    expect(synced.saves.f1.log).toHaveLength(1)
  })
})

describe('removing a profile', () => {
  it('keeps only what is needed to sync the removal', () => {
    const t = tombstone(florien, NOW)
    expect(t).toEqual({
      id: 'f1',
      name: '',
      avatar: '',
      color: '',
      createdAt: 1,
      updatedAt: NOW,
      deletedAt: NOW,
    })
    // Older removals forget who it was when loaded.
    expect(migrateProfiles([{ ...florien, deletedAt: 3 }])[0].name).toBe('')
  })

  it('wins over an older copy on another device, which loses the progress', () => {
    const merged = mergeFamily(
      { profiles: [tombstone(florien, NOW)], saves: {} },
      { profiles: [florien], saves: { f1: withProgress('f1', 5) } },
    )
    expect(merged.profiles[0].name).toBe('')
    expect(merged.saves.f1).toBeUndefined()
  })
})
