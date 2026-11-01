import type { Method } from '../deck/types'

export const SAVE_VERSION = 1

export type Grade = 1 | 2 | 3 | 4

/** FSRS state of one review item (a card × a template), plus how it's asked in Learn. */
export interface ItemRecord {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  /** 0 new, 1 learning, 2 review, 3 relearning */
  state: 0 | 1 | 2 | 3
  last_review?: number
  /** Graduated answers: multiple choice first, typing once that went right. */
  stage?: 'choose' | 'type'
}

export interface DeckProgress {
  /** Template ids switched on, if the learner changed the deck's defaults. */
  templates?: string[]
  /** A test date, `YYYY-MM-DD`. */
  testDate?: string
  /** When `templates` or `testDate` last changed, for merging. */
  updatedAt: number
  /** card id → template id → record */
  items: Record<string, Record<string, ItemRecord>>
}

export type Mode = 'learn' | 'type' | 'choose' | 'listen' | 'flip' | 'sprint' | 'race'

export interface ReviewEntry {
  t: number
  deck: string
  card: string
  template: string
  mode: Mode
  method: Method
  correct: boolean
  grade?: Grade
  hints: number
  ms: number
  /** What was typed or chosen, when it was wrong. */
  answered?: string
  /** A new card was introduced (shown before it was asked). */
  intro?: boolean
}

export interface SprintRecord {
  t: number
  deck: string
  template: string
  method: Method
  minutes: number
  score: number
  wrong: number
}

export interface RaceRecord {
  t: number
  deck: string
  /** 'all' or a tag */
  set: string
  template: string
  method: Method
  count: number
  ms: number
  wrong: number
}

export type VoiceSetting = 'female' | 'male' | 'random'
export type AnswerStyle = 'auto' | 'type' | 'choose' | 'flip'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  language: 'nl' | 'en'
  voice: VoiceSetting
  autoplay: boolean
  sounds: boolean
  theme: Theme
  /** Answers per day. */
  dailyGoal: number
  /** New cards per deck per day. */
  newPerDay: number
  /** Questions per Learn session. */
  sessionSize: number
  answerStyle: AnswerStyle
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'nl',
  voice: 'random',
  autoplay: true,
  sounds: true,
  theme: 'system',
  dailyGoal: 30,
  newPerDay: 10,
  sessionSize: 20,
  answerStyle: 'auto',
}

export interface Profile {
  id: string
  name: string
  avatar: string
  color: string
  createdAt: number
  updatedAt: number
  /** Set when the profile was removed; kept so the removal syncs. */
  deletedAt?: number
}

export interface ProfileSave {
  version: 1
  profileId: string
  settings: Settings
  settingsUpdatedAt: number
  decks: Record<string, DeckProgress>
  log: ReviewEntry[]
  sprints: SprintRecord[]
  races: RaceRecord[]
}

export function emptySave(profileId: string): ProfileSave {
  return {
    version: SAVE_VERSION,
    profileId,
    settings: { ...DEFAULT_SETTINGS },
    settingsUpdatedAt: 0,
    decks: {},
    log: [],
    sprints: [],
    races: [],
  }
}

export const AVATARS = [
  '🦊',
  '🐼',
  '🐯',
  '🦄',
  '🐸',
  '🐙',
  '🦁',
  '🐨',
  '🐰',
  '🐧',
  '🐢',
  '🐬',
  '🦉',
  '🐝',
  '🦖',
  '🐱',
]
export const COLORS = [
  '#ff6b4a',
  '#f5a524',
  '#22a06b',
  '#1e9bd7',
  '#7c5cff',
  '#e5487d',
  '#14b8a6',
  '#8b5e3c',
]
