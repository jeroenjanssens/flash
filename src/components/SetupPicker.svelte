<script lang="ts">
  import type { Deck, Template } from '../lib/deck/types'
  import { cardsInSet, setOptions, type CardSet } from '../lib/study/sets'
  import { save } from '../state/app.svelte'
  import { loc, t } from '../state/i18n.svelte'

  /** Choose a direction (template) and which cards, for practice, sprint and race. */
  let {
    deck,
    templates,
    template = $bindable(),
    set = $bindable(),
    list = [],
  }: {
    deck: Deck
    templates: Template[]
    template: string
    set: CardSet
    /** The cards of the 'list' set (mistakes to practise). */
    list?: string[]
  } = $props()

  const sets = $derived(setOptions(deck))
  const tpl = $derived(deck.templates.find((x) => x.id === template))
  /** How many cards each set has in the chosen direction. */
  const counts = $derived(
    new Map(
      [...sets, 'list' as const].map((x) => [
        x,
        tpl ? cardsInSet(deck, tpl, x, save(), list).length : 0,
      ]),
    ),
  )
  const setLabel = (s: CardSet) =>
    s === 'all' || s === 'seen' || s === 'learning' || s === 'list' ? t(`set.${s}`) : s.slice(4)
</script>

<div class="stack">
  {#if templates.length > 1}
    <fieldset>
      <legend>{t('setup.direction')}</legend>
      <div class="row">
        {#each templates as tpl (tpl.id)}
          <button
            class="chip big"
            type="button"
            aria-pressed={template === tpl.id}
            onclick={() => (template = tpl.id)}
          >
            {loc(tpl.name) || tpl.id}
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}
  {#if sets.length > 1}
    <fieldset>
      <legend>{t('setup.cards')}</legend>
      <div class="row">
        {#if set === 'list'}
          <button class="chip big" type="button" aria-pressed="true"
            >{setLabel('list')} <span class="count">{counts.get('list')}</span></button
          >
        {/if}
        {#each sets as s (s)}
          <button
            class="chip big"
            type="button"
            aria-pressed={set === s}
            disabled={!counts.get(s) && set !== s}
            onclick={() => (set = s)}
            >{setLabel(s)} <span class="count">{counts.get(s)}</span></button
          >
        {/each}
      </div>
    </fieldset>
  {/if}
</div>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  legend {
    font-weight: 800;
    margin-bottom: 10px;
  }
  .count {
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
  .chip:disabled {
    opacity: 0.4;
  }
  .chip.big {
    min-height: 44px;
    padding: 8px 16px;
    font-size: 0.95rem;
  }
</style>
