<script lang="ts">
  import type { Snippet } from 'svelte'
  import { imageField, mainTextField } from '../lib/deck/items'
  import type { Card } from '../lib/deck/types'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import Confetti from './Confetti.svelte'
  import FieldView from './FieldView.svelte'

  /** The end of a session: how it went, and the cards to practise. */
  let {
    title,
    stats,
    mistakes = [],
    celebrate = false,
    actions,
  }: {
    title: string
    stats: { label: string; value: string }[]
    mistakes?: { loaded: LoadedDeck; card: Card }[]
    celebrate?: boolean
    actions: Snippet
  } = $props()
</script>

{#if celebrate}<Confetti />{/if}

<div class="summary">
  <div class="medal" aria-hidden="true">{celebrate ? '🏆' : mistakes.length ? '💪' : '🌟'}</div>
  <h1>{title}</h1>
  <div class="stats">
    {#each stats as s (s.label)}
      <div class="stat panel">
        <strong>{s.value}</strong>
        <span class="muted small">{s.label}</span>
      </div>
    {/each}
  </div>
  {#if mistakes.length}
    <div class="mistakes">
      <h2>{t('summary.practise')}</h2>
      <div class="list">
        {#each mistakes as m (m.loaded.deck.id + m.card.id)}
          {@const img = imageField(m.loaded.deck)}
          {@const word = mainTextField(m.loaded.deck)}
          <div class="mistake panel">
            {#if img && m.card.fields[img]}<FieldView
                loaded={m.loaded}
                card={m.card}
                field={img}
                size="small"
              />{/if}
            {#if word}<FieldView
                loaded={m.loaded}
                card={m.card}
                field={word}
                size="small"
                withAudio
              />{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
  <div class="row actions">{@render actions()}</div>
</div>

<style>
  .summary {
    display: grid;
    gap: 20px;
    justify-items: center;
    text-align: center;
    padding-top: 24px;
  }
  .medal {
    font-size: 72px;
    animation: bounce 0.6s ease;
  }
  .stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .stat {
    display: grid;
    min-width: 120px;
    padding: 14px 18px;
  }
  .stat strong {
    font-size: 1.8rem;
  }
  .mistakes {
    display: grid;
    gap: 10px;
    width: 100%;
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .mistake {
    display: grid;
    gap: 6px;
    padding: 12px;
    justify-items: center;
  }
  .actions {
    justify-content: center;
  }
  @keyframes bounce {
    0% {
      transform: scale(0.3);
    }
    60% {
      transform: scale(1.15);
    }
  }
</style>
