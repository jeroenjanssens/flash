import { langOf } from '../lib/deck/items'
import type { TextValue, Voice } from '../lib/deck/types'
import type { VoiceSetting } from '../lib/storage/schema'
import { audio } from './app.svelte'
import { mediaUrl, type LoadedDeck } from './decks.svelte'

/** The voice to use for a question: the learner's choice, or a random one ('random'). */
export function pickVoice(voices: Voice[] | undefined, setting: VoiceSetting): Voice | undefined {
  if (!voices?.length) return undefined
  if (setting === 'random') return voices[Math.floor(Math.random() * voices.length)]
  return voices.find((v) => v.gender === setting) ?? voices[0]
}

export function audioUrl(
  loaded: LoadedDeck,
  value: TextValue | undefined,
  voice?: Voice,
): string | undefined {
  if (!value?.audio) return undefined
  const src = (voice && value.audio[voice.id]) ?? Object.values(value.audio)[0]
  return mediaUrl(loaded, src)
}

/** Say a text value: its recorded audio in the voice, or the device's speech synthesis. */
export async function say(
  loaded: LoadedDeck,
  fieldId: string,
  value: TextValue | undefined,
  voice?: Voice,
): Promise<void> {
  if (!value) return
  const url = audioUrl(loaded, value, voice)
  if (url && (await audio.play(url))) return
  await audio.speak(value.text, langOf(loaded.deck, fieldId, value), voice?.gender)
}

export function preload(loaded: LoadedDeck, value: TextValue | undefined, voice?: Voice): void {
  audio.preload(audioUrl(loaded, value, voice))
}
