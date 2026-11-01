<script lang="ts">
  import type { Deck, Template } from '../lib/deck/types'
  import { setOptions, type CardSet } from '../lib/study/sets'
  import { loc, t } from '../state/i18n.svelte'

  /** Choose a direction (template) and which cards, for practice, sprint and race. */
  let {
    deck,
    templates,
    template = $bindable(),
    set = $bindable(),
    showSet = true,
    allowLearning = true,
  }: {
    deck: Deck
    templates: Template[]
    template: string
    set: CardSet
    showSet?: boolean
    allowLearning?: boolean
  } = $props()

  const sets = $derived(setOptions(deck).filter((s) => allowLearning || s !== 'learning'))
  const setLabel = (s: CardSet) =>
    s === 'all'
      ? t('set.all')
      : s === 'learning'
        ? t('set.learning')
        : s === 'list'
          ? t('set.list')
          : s.slice(4)
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
  {#if showSet && sets.length > 1}
    <fieldset>
      <legend>{t('setup.cards')}</legend>
      <div class="row">
        {#if set === 'list'}
          <button class="chip big" type="button" aria-pressed="true">{setLabel('list')}</button>
        {/if}
        {#each sets as s (s)}
          <button class="chip big" type="button" aria-pressed={set === s} onclick={() => (set = s)}
            >{setLabel(s)}</button
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
  .chip.big {
    min-height: 44px;
    padding: 8px 16px;
    font-size: 0.95rem;
  }
</style>
