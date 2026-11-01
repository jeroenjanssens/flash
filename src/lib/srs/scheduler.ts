import { type Card, type FSRS, State, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Grade, ItemRecord } from '../storage/schema'
import { DAY, daysUntil, startOfDay, addDays } from '../time'

const schedulers = new Map<number, FSRS>()

function scheduler(retention: number): FSRS {
  let s = schedulers.get(retention)
  if (!s) {
    s = fsrs({
      request_retention: retention,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    })
    schedulers.set(retention, s)
  }
  return s
}

/**
 * The retention to aim for: 90% normally, 95% in the week before a test, so cards come back
 * more often when it matters.
 */
export function retentionFor(now: number, testDate?: string): number {
  if (!testDate) return 0.9
  const days = daysUntil(testDate, now)
  return days >= 0 && days <= 7 ? 0.95 : 0.9
}

export function toCard(r: ItemRecord): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    ...(r.last_review !== undefined ? { last_review: new Date(r.last_review) } : {}),
  }
}

export function fromCard(card: Card, stage?: ItemRecord['stage']): ItemRecord {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as ItemRecord['state'],
    ...(card.last_review ? { last_review: card.last_review.getTime() } : {}),
    ...(stage ? { stage } : {}),
  }
}

export function newRecord(now: number): ItemRecord {
  return fromCard(createEmptyCard(new Date(now)))
}

/**
 * Before a test, a card that would next be due after the test comes back on the day before it
 * instead, so everything is seen once more. (On the day before and on the day itself, nothing
 * changes: the learning steps already bring cards back the same day.)
 */
export function capForTest(due: number, now: number, testDate?: string): number {
  if (!testDate) return due
  const dayBefore = startOfDay(addDays(testDate, -1))
  if (now >= dayBefore || due <= dayBefore) return due
  // Early on the day before: in time for after school, or whenever they practise.
  return dayBefore + 6 * 3_600_000
}

/** Apply a grade to an item (creating it if it's new) and return the updated record. */
export function grade(
  record: ItemRecord | undefined,
  rating: Grade,
  now: number,
  testDate?: string,
): ItemRecord {
  const card = toCard(record ?? newRecord(now))
  const next = fromCard(
    scheduler(retentionFor(now, testDate)).next(card, new Date(now), rating).card,
    record?.stage,
  )
  const capped = capForTest(next.due, now, testDate)
  if (capped !== next.due) {
    next.due = capped
    next.scheduled_days = Math.max(0, Math.round((capped - now) / DAY))
  }
  return next
}

/** The chance of remembering the item now (undefined for new items). */
export function retrievability(record: ItemRecord | undefined, now: number): number | undefined {
  if (!record || record.state === 0) return undefined
  return scheduler(0.9).get_retrievability(toCard(record), new Date(now), false)
}
