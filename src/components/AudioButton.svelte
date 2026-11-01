<script lang="ts">
  import type { TextValue, Voice } from '../lib/deck/types'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { say } from '../state/speak'
  import Icon from './Icon.svelte'

  let {
    loaded,
    field,
    value,
    voice,
    size = 'normal',
    label,
  }: {
    loaded: LoadedDeck
    field: string
    value: TextValue | undefined
    voice?: Voice
    size?: 'small' | 'normal' | 'huge'
    label?: string
  } = $props()

  let playing = $state(false)

  export async function play() {
    playing = true
    try {
      await say(loaded, field, value, voice)
    } finally {
      playing = false
    }
  }
</script>

<button
  type="button"
  class="audio {size}"
  class:playing
  onclick={(e) => {
    e.stopPropagation()
    void play()
  }}
  aria-label={label ?? t('common.listen')}
  title={label ?? t('common.listen')}
>
  <Icon name="speaker" size={size === 'huge' ? 56 : size === 'small' ? 18 : 24} />
  {#if label && size !== 'huge'}<span>{label}</span>{/if}
</button>

<style>
  .audio {
    appearance: none;
    border: 0;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: color-mix(in srgb, var(--accent) 85%, var(--ink));
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    transition: transform 0.12s;
  }
  .audio:active {
    transform: scale(0.94);
  }
  .small {
    min-width: 36px;
    min-height: 36px;
    padding: 0 10px;
    font-size: 0.85rem;
  }
  .huge {
    width: 128px;
    height: 128px;
    box-shadow: var(--shadow);
  }
  .playing {
    animation: pulse 0.8s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    to {
      transform: scale(1.06);
    }
  }
</style>
