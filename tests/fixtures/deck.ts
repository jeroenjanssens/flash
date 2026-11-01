import type { Deck } from '../../src/lib/deck/types'

/** A small deck with every kind of template, for tests. */
export function testDeck(): Deck {
  const word = (text: string, extra = {}) => ({ text, ...extra })
  const card = (id: string, en: string, nl: string, tags: string[], extra = {}) => ({
    id,
    fields: {
      image: { src: `media/${id}.webp` },
      word: word(en, { audio: { female: `media/audio/female/${id}.mp3` } }),
      translation: word(nl),
    },
    tags,
    ...extra,
  })
  return {
    format: 'flash-deck',
    formatVersion: 1,
    id: 'deck-1',
    revision: 1,
    title: { en: 'Test', nl: 'Test' },
    language: 'en-GB',
    voices: [{ id: 'female', lang: 'en-GB' }],
    fields: [
      { id: 'image', type: 'image' },
      { id: 'word', type: 'text', lang: 'en-GB', speak: true },
      { id: 'translation', type: 'text', lang: 'nl', optional: true },
    ],
    templates: [
      {
        id: 'picture-to-word',
        prompt: ['image'],
        answer: 'word',
        methods: ['type', 'choose', 'flip'],
      },
      {
        id: 'dutch-to-english',
        prompt: ['translation'],
        answer: 'word',
        methods: ['type', 'choose', 'flip'],
      },
      {
        id: 'word-to-picture',
        prompt: ['word'],
        answer: 'image',
        methods: ['choose'],
        enabled: false,
      },
      {
        id: 'listen-to-picture',
        prompt: [{ field: 'word', as: 'audio' }],
        answer: 'image',
        methods: ['choose'],
        enabled: false,
      },
    ],
    cards: [
      card('fork', 'fork', 'vork', ['kitchen'], { confusable: ['knife', 'spoon'] }),
      card('knife', 'knife', 'mes', ['kitchen'], { confusable: ['fork'] }),
      card('spoon', 'spoon', 'lepel', ['kitchen']),
      card('cup', 'cup', 'beker', ['kitchen']),
      card('king', 'king', 'koning', ['castle']),
      card('queen', 'queen', 'koningin', ['castle']),
      card('bridge', 'draw bridge', 'ophaalbrug', ['castle']),
    ],
  }
}
