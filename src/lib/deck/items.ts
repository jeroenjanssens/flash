import { promptField } from './parse'
import {
  isMedia,
  isText,
  type Card,
  type Deck,
  type Localized,
  type Method,
  type Template,
  type TextValue,
} from './types'

/** One thing to review: a card asked in one way. */
export interface Item {
  card: Card
  template: Template
}

export const itemKey = (cardId: string, templateId: string) => `${cardId}/${templateId}`

/** Pick the text for an interface language, falling back to English and then anything. */
export function localized(text: Localized | undefined, lang: string): string {
  if (!text) return ''
  return text[lang] ?? text.en ?? Object.values(text)[0] ?? ''
}

export function fieldOf(deck: Deck, id: string) {
  return deck.fields.find((f) => f.id === id)
}

/** The language of a text value: its own, or its field's. */
export function langOf(deck: Deck, fieldId: string, value?: TextValue): string {
  return value?.lang ?? fieldOf(deck, fieldId)?.lang ?? deck.language
}

export function textOf(card: Card, fieldId: string): TextValue | undefined {
  const v = card.fields[fieldId]
  return isText(v) ? v : undefined
}

/** A template applies to a card when the card has everything the prompt and answer need. */
export function applies(template: Template, card: Card): boolean {
  if (card.suspended) return false
  const needed = [...template.prompt.map(promptField), template.answer]
  return needed.every((f) => card.fields[f] !== undefined)
}

/** The templates switched on for a learner: their own choice, or the deck's defaults. */
export function activeTemplates(deck: Deck, chosen?: string[]): Template[] {
  if (chosen) return deck.templates.filter((t) => chosen.includes(t.id))
  return deck.templates.filter((t) => t.enabled !== false)
}

export function itemsFor(deck: Deck, templates: Template[]): Item[] {
  const out: Item[] = []
  for (const card of deck.cards)
    for (const template of templates) if (applies(template, card)) out.push({ card, template })
  return out
}

/** What makes two answers the same, for multiple choice: the text, or the picture. */
export function answerKey(card: Card, fieldId: string): string | undefined {
  const v = card.fields[fieldId]
  if (isText(v)) return v.text.trim().toLowerCase()
  if (isMedia(v)) return v.src
  return undefined
}

export function isPictureAnswer(deck: Deck, template: Template): boolean {
  return fieldOf(deck, template.answer)?.type === 'image'
}

/** Whether the template plays audio as (part of) its prompt. */
export function hasSpokenPrompt(template: Template): boolean {
  return template.prompt.some((p) => typeof p !== 'string' && p.as === 'audio')
}

export function templatesWithMethod(deck: Deck, method: Method): Template[] {
  return deck.templates.filter((t) => t.methods?.includes(method))
}

/** All tags used by the deck's cards, in order of first use. */
export function deckTags(deck: Deck): string[] {
  return [...new Set(deck.cards.flatMap((c) => c.tags ?? []))]
}

/** The text field a card is best known by (for lists): the first spoken text field, or any. */
export function mainTextField(deck: Deck): string | undefined {
  return (
    deck.fields.find((f) => f.type === 'text' && f.speak)?.id ??
    deck.fields.find((f) => f.type === 'text')?.id
  )
}

export function translationField(deck: Deck): string | undefined {
  const main = mainTextField(deck)
  return deck.fields.find((f) => f.type === 'text' && f.id !== main)?.id
}

export function imageField(deck: Deck): string | undefined {
  return deck.fields.find((f) => f.type === 'image')?.id
}
