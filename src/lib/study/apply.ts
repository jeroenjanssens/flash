import { grade } from '../srs/scheduler'
import { nextStage, type SessionItem } from '../srs/queue'
import type { ItemRecord, Mode, ProfileSave, ReviewEntry } from '../storage/schema'
import { autoGrade, type Answer } from './grade'

/** The log is trimmed to this many entries (oldest first); years of daily practice fit. */
export const MAX_LOG = 50_000

/**
 * Record an answer: always in the log; in Learn (and its extra rounds) also in the schedule (and
 * the learn stage).
 * Returns the item's new record, or undefined when the schedule didn't change.
 */
export function applyAnswer(
  save: ProfileSave,
  item: SessionItem,
  answer: Answer,
  mode: Mode,
  now: number,
): ItemRecord | undefined {
  const deckId = item.deck.id
  let progress = save.decks[deckId]
  if (!progress) progress = save.decks[deckId] = { updatedAt: 0, items: {} }
  const before = progress.items[item.card.id]?.[item.template.id]
  let record: ItemRecord | undefined
  let rating: ReviewEntry['grade']
  if (mode === 'learn' || mode === 'extra') {
    rating = autoGrade(answer, before)
    record = grade(before, rating, now, progress.testDate)
    const stage = nextStage(answer.method, answer.correct, before?.stage)
    if (stage) record.stage = stage
    progress.items[item.card.id] ??= {}
    progress.items[item.card.id][item.template.id] = record
  }
  const entry: ReviewEntry = {
    t: now,
    deck: deckId,
    card: item.card.id,
    template: item.template.id,
    mode,
    method: answer.method,
    correct: answer.correct,
    hints: answer.hints,
    ms: Math.round(answer.ms),
    ...(rating ? { grade: rating } : {}),
    ...(answer.answered && !answer.correct ? { answered: answer.answered.slice(0, 80) } : {}),
    ...(item.intro ? { intro: true } : {}),
  }
  save.log.push(entry)
  if (save.log.length > MAX_LOG) save.log.splice(0, save.log.length - MAX_LOG)
  return record
}
