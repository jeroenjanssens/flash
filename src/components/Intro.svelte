<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { imageField, mainTextField, translationField } from '../lib/deck/items'
  import type { Card, Voice } from '../lib/deck/types'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { audio } from '../state/app.svelte'
  import FieldView from './FieldView.svelte'
  import Icon from './Icon.svelte'

  /** A new card, shown before it's asked: everything at once, with its sound. */
  let {
    loaded,
    card,
    voice,
    ondone,
  }: { loaded: LoadedDeck; card: Card; voice?: Voice; ondone: () => void } = $props()

  const image = $derived(imageField(loaded.deck))
  const main = $derived(mainTextField(loaded.deck))
  const translation = $derived(translationField(loaded.deck))
  let word = $state<FieldView>()

  onMount(() => {
    audio.sfx('flip')
    void tick().then(() => setTimeout(() => word?.play(), 250))
  })

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ondone()
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="intro">
  <p class="chip accent new">{t('learn.newWord')}</p>
  {#if image && card.fields[image]}
    <FieldView {loaded} {card} field={image} size="big" />
  {/if}
  {#if main}
    <FieldView bind:this={word} {loaded} {card} field={main} {voice} size="big" withAudio />
  {/if}
  {#if translation && card.fields[translation]}
    <div class="translation"><FieldView {loaded} {card} field={translation} size="medium" /></div>
  {/if}
  <button class="btn big primary" onclick={ondone}
    >{t('learn.gotIt')}<Icon name="next" /> <kbd>↵</kbd></button
  >
</div>

<style>
  .intro {
    display: grid;
    gap: 18px;
    justify-items: center;
    animation: in 0.35s ease;
  }
  .new {
    font-size: 0.95rem;
  }
  .translation {
    color: var(--ink-2);
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: rotateY(25deg) scale(0.96);
    }
  }
</style>
