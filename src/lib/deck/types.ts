/** The deck format (version 1). See docs/deck-format.md and schema/deck.schema.json. */

/** Text in one or more interface languages, keyed by BCP 47 tag. */
export type Localized = Record<string, string>

export interface Voice {
  id: string
  name?: Localized
  gender?: 'female' | 'male' | 'other'
  lang: string
  engine?: string
  voice?: string
  credit?: string
  license?: string
}

export type FieldType = 'text' | 'image' | 'audio' | 'video'

export interface Field {
  id: string
  type: FieldType
  lang?: string
  name?: Localized
  optional?: boolean
  speak?: boolean
}

export type PromptItem = string | { field: string; as?: 'text' | 'audio' }

export type Method = 'type' | 'choose' | 'flip'
export const METHODS: readonly Method[] = ['type', 'choose', 'flip']

export interface Template {
  id: string
  name?: Localized
  description?: Localized
  prompt: PromptItem[]
  answer: string
  reveal?: PromptItem[]
  methods?: Method[]
  enabled?: boolean
}

export interface TextValue {
  text: string
  lang?: string
  accept?: string[]
  hint?: string
  audio?: Record<string, string>
}

export interface MediaValue {
  src: string
  type?: string
  width?: number
  height?: number
  alt?: Localized
  credit?: string
  license?: string
  source?: string
}

export type Value = TextValue | MediaValue

export interface Card {
  id: string
  ref?: string
  fields: Record<string, Value>
  confusable?: string[]
  tags?: string[]
  suspended?: boolean
}

export interface Collection {
  id: string
  title: Localized
  position?: number
}

export interface Source {
  title?: string
  publisher?: string
  author?: string
  url?: string
  copyright?: string
  license?: string
  notes?: string
}

export interface Deck {
  format: 'flash-deck'
  formatVersion: 1
  id: string
  revision: number
  createdAt?: string
  updatedAt?: string
  title: Localized
  description?: Localized
  cover?: string
  color?: string
  collection?: Collection
  language: string
  tags?: string[]
  source?: Source
  voices?: Voice[]
  fields: Field[]
  templates: Template[]
  cards: Card[]
}

export function isText(value: Value | undefined): value is TextValue {
  return !!value && typeof (value as TextValue).text === 'string'
}

export function isMedia(value: Value | undefined): value is MediaValue {
  return !!value && typeof (value as MediaValue).src === 'string'
}
