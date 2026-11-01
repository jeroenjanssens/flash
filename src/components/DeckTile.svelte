<script lang="ts">
  import { deckCounts } from '../lib/srs/queue'
  import { cardLevels, deckProgress } from '../lib/study/stats'
  import { daysUntil } from '../lib/time'
  import { save } from '../state/app.svelte'
  import { mediaUrl, type LoadedDeck } from '../state/decks.svelte'
  import { loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'

  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const counts = $derived(deckCounts(deck, save(), Date.now()))
  const progress = $derived(deckProgress(cardLevels(deck, save())))
  const testDate = $derived(save().decks[deck.id]?.testDate)
  const testIn = $derived(testDate ? daysUntil(testDate, Date.now()) : undefined)
</script>

<a class="tile" href={href(`deck/${deck.id}`)} style:--c={deck.color ?? 'var(--primary)'}>
  <div class="cover">
    {#if deck.cover}<img src={mediaUrl(loaded, deck.cover)} alt="" />{/if}
    {#if counts.due + counts.newCards > 0}
      <span class="badge">{counts.due + counts.newCards}</span>
    {/if}
  </div>
  <div class="body">
    <strong class="name">{loc(deck.title)}</strong>
    {#if deck.collection}<span class="muted small">{loc(deck.collection.title)}</span>{/if}
    <div class="bar" aria-label={t('deck.progress', { percent: Math.round(progress * 100) })}>
      <div style:width="{progress * 100}%"></div>
    </div>
    {#if testIn !== undefined && testIn >= 0}
      <span class="chip warn"
        >📅 {testIn === 0 ? t('test.today') : t('test.inDays', { days: testIn })}</span
      >
    {/if}
  </div>
</a>

<style>
  .tile {
    display: grid;
    text-decoration: none;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    transition: transform 0.15s;
  }
  .tile:hover {
    transform: translateY(-3px) rotate(-0.5deg);
  }
  .cover {
    position: relative;
    height: 130px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--c) 22%, var(--surface));
  }
  .cover img {
    max-height: 104px;
    max-width: 84%;
    object-fit: contain;
    border-radius: 10px;
    transform: rotate(-3deg);
    box-shadow: var(--shadow);
    background: white;
  }
  .badge {
    position: absolute;
    top: 10px;
    right: 10px;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--primary);
    color: white;
    font-weight: 900;
    display: grid;
    place-items: center;
  }
  .body {
    display: grid;
    gap: 6px;
    padding: 14px 16px 16px;
    justify-items: start;
  }
  .name {
    font-size: 1.15rem;
  }
  .bar {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--c);
    border-radius: 999px;
  }
</style>
