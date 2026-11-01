import type {
  DeckProgress,
  ItemRecord,
  Profile,
  ProfileSave,
  RaceRecord,
  ReviewEntry,
  SprintRecord,
} from './schema'

/** The record that was reviewed last (ties: more reviews, then the later due date). */
function newerItem(a: ItemRecord | undefined, b: ItemRecord | undefined): ItemRecord {
  if (!a) return b!
  if (!b) return a
  const ta = a.last_review ?? 0
  const tb = b.last_review ?? 0
  if (ta !== tb) return ta > tb ? a : b
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b
  return a.due >= b.due ? a : b
}

function mergeDeck(a: DeckProgress | undefined, b: DeckProgress | undefined): DeckProgress {
  if (!a) return structuredClone(b!)
  if (!b) return structuredClone(a)
  const choice = b.updatedAt > a.updatedAt ? b : a
  const out: DeckProgress = { updatedAt: Math.max(a.updatedAt, b.updatedAt), items: {} }
  if (choice.templates) out.templates = [...choice.templates]
  if (choice.testDate) out.testDate = choice.testDate
  for (const card of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) {
    const x = a.items[card] ?? {}
    const y = b.items[card] ?? {}
    out.items[card] = {}
    for (const tpl of new Set([...Object.keys(x), ...Object.keys(y)]))
      out.items[card][tpl] = structuredClone(newerItem(x[tpl], y[tpl]))
  }
  return out
}

const logKey = (e: ReviewEntry) => `${e.t}|${e.deck}|${e.card}|${e.template}|${e.mode}`

function union<T>(a: T[], b: T[], key: (x: T) => string, order: (x: T) => number): T[] {
  const seen = new Map<string, T>()
  for (const x of [...a, ...b]) if (!seen.has(key(x))) seen.set(key(x), x)
  return [...seen.values()].sort((p, q) => order(p) - order(q)).map((x) => structuredClone(x))
}

/**
 * Merge two copies of a profile's progress without losing work:
 * - each review item: the copy reviewed most recently
 * - deck choices (templates, test date): the copy changed most recently
 * - the log, sprints and races: the union, in time order
 * - settings: the copy changed most recently
 */
export function mergeSaves(a: ProfileSave, b: ProfileSave): ProfileSave {
  const settings = b.settingsUpdatedAt > a.settingsUpdatedAt ? b : a
  const decks: ProfileSave['decks'] = {}
  for (const id of new Set([...Object.keys(a.decks), ...Object.keys(b.decks)]))
    decks[id] = mergeDeck(a.decks[id], b.decks[id])
  return {
    version: 1,
    profileId: a.profileId,
    settings: structuredClone(settings.settings),
    settingsUpdatedAt: Math.max(a.settingsUpdatedAt, b.settingsUpdatedAt),
    decks,
    log: union(a.log, b.log, logKey, (e) => e.t),
    sprints: union<SprintRecord>(
      a.sprints,
      b.sprints,
      (s) => `${s.t}|${s.deck}`,
      (s) => s.t,
    ),
    races: union<RaceRecord>(
      a.races,
      b.races,
      (r) => `${r.t}|${r.deck}`,
      (r) => r.t,
    ),
  }
}

/** Merge two profile lists: every profile once, the most recently changed copy of each. */
export function mergeProfiles(a: Profile[], b: Profile[]): Profile[] {
  const out = new Map<string, Profile>()
  for (const p of [...a, ...b]) {
    const q = out.get(p.id)
    if (!q || p.updatedAt > q.updatedAt) out.set(p.id, { ...p })
  }
  return [...out.values()].sort((p, q) => p.createdAt - q.createdAt)
}
