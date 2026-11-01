<script lang="ts">
  import { addDays, dayKey } from '../../lib/time'
  import { formatDate, t } from '../../state/i18n.svelte'

  /** Review items due on each of the next days. */
  let { counts }: { counts: number[] } = $props()
  const max = $derived(Math.max(1, ...counts))
  const today = dayKey(Date.now())
</script>

<div class="forecast" role="img" aria-label={t('stats.forecast')}>
  {#each counts as n, i (i)}
    {@const day = addDays(today, i)}
    <div
      class="col"
      title="{formatDate(day, { weekday: 'short', day: 'numeric', month: 'short' })}: {n}"
    >
      <span class="n">{n || ''}</span>
      <div class="bar" style:height="{(n / max) * 100}%" class:today={i === 0}></div>
      <span class="d"
        >{i === 0 ? t('stats.todayShort') : formatDate(day, { weekday: 'narrow' })}</span
      >
    </div>
  {/each}
</div>

<style>
  .forecast {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 4px;
    height: 140px;
    align-items: end;
  }
  .col {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    justify-items: center;
    align-items: end;
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .bar {
    width: 100%;
    min-height: 2px;
    border-radius: 6px 6px 2px 2px;
    background: color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .bar.today {
    background: var(--accent);
  }
  .n {
    font-weight: 800;
    color: var(--ink-2);
  }
</style>
