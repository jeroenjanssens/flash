<script lang="ts">
  import { fieldOf, langOf } from '../lib/deck/items'
  import { isMedia, isText, type Card, type Voice } from '../lib/deck/types'
  import { mediaUrl, type LoadedDeck } from '../state/decks.svelte'
  import AudioButton from './AudioButton.svelte'

  /** One field of a card: a picture, a word, or (spoken) a play button. */
  let {
    loaded,
    card,
    field,
    as = 'text',
    voice,
    size = 'big',
    withAudio = false,
  }: {
    loaded: LoadedDeck
    card: Card
    field: string
    as?: 'text' | 'audio'
    voice?: Voice
    size?: 'big' | 'medium' | 'small'
    withAudio?: boolean
  } = $props()

  const def = $derived(fieldOf(loaded.deck, field))
  const value = $derived(card.fields[field])
  let button = $state<AudioButton>()

  export function play() {
    return button?.play()
  }
</script>

{#if def && value}
  {#if as === 'audio' && isText(value)}
    <AudioButton bind:this={button} {loaded} {field} {value} {voice} size="huge" />
  {:else if def.type === 'image' && isMedia(value)}
    <img
      class="picture {size}"
      src={mediaUrl(loaded, value.src)}
      alt=""
      width={value.width}
      height={value.height}
      draggable="false"
    />
  {:else if isText(value)}
    <div class="text {size}">
      <span class="word" lang={langOf(loaded.deck, field, value)}>{value.text}</span>
      {#if withAudio && def.speak}
        <AudioButton bind:this={button} {loaded} {field} {value} {voice} size="small" />
      {/if}
    </div>
  {/if}
{/if}

<style>
  .picture {
    display: block;
    object-fit: contain;
    margin: 0 auto;
    border-radius: 16px;
    background: #fff;
    padding: 6px;
    box-sizing: content-box;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .picture.big {
    padding: 16px;
    width: auto;
    height: auto;
    max-width: min(calc(100% - 32px), 440px);
    max-height: min(34vh, 300px);
    min-height: min(22vh, 160px);
  }
  .picture.medium {
    max-height: 160px;
    max-width: calc(100% - 12px);
  }
  .picture.small {
    max-height: 100px;
    max-width: calc(100% - 12px);
  }
  .text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    text-align: center;
  }
  .text.big .word {
    font-size: clamp(2.2rem, 8vw, 3.4rem);
    line-height: 1.1;
  }
  .text.medium .word {
    font-size: 1.6rem;
  }
  .text.small .word {
    font-size: 1.1rem;
  }
</style>
