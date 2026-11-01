import type { Method } from '../deck/types'
import type { Grade, ItemRecord } from '../storage/schema'

/** The result of answering one question, whatever the mode. */
export interface Answer {
  method: Method
  correct: boolean
  /** For typing: the second try after "almost" was right. */
  corrected?: boolean
  hints: number
  ms: number
  /** What was typed or chosen (a card id for choices), when it was wrong. */
  answered?: string
  /** Flip: the grade the learner gave themselves. */
  selfGrade?: Grade
}

/**
 * Turn an answer into an FSRS grade, so a child never has to judge themselves:
 * - wrong → Again
 * - right after a hint, or after fixing a small typo → Hard
 * - right → Good
 * - typed right at once, without hints, on a card that's already known, quickly → Easy
 * Multiple choice is never Easy: recognising is easier than remembering.
 */
export function autoGrade(answer: Answer, record?: ItemRecord): Grade {
  if (answer.method === 'flip') return answer.selfGrade ?? (answer.correct ? 3 : 1)
  if (!answer.correct) return 1
  if (answer.hints > 0 || answer.corrected) return 2
  if (answer.method === 'type' && record?.state === 2 && answer.ms < 6000) return 4
  return 3
}
