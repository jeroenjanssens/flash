<script lang="ts">
  import { LEVELS, type LevelCounts } from '../../lib/study/stats'
  import { t } from '../../state/i18n.svelte'

  /** New / learning / known / mastered as one stacked bar. */
  let { counts }: { counts: LevelCounts } = $props()
  const total = $derived(LEVELS.reduce((s, l) => s + counts[l], 0) || 1)
  const colors = {
    new: 'var(--line)',
    learning: 'var(--warn)',
    known: 'var(--good)',
    mastered: 'var(--star)',
  }
</script>

<div
  class="bar"
  role="img"
  aria-label={LEVELS.map((l) => `${t(`level.${l}`)}: ${counts[l]}`).join(', ')}
>
  {#each LEVELS as l (l)}
    {#if counts[l]}
      <div
        style:width="{(counts[l] / total) * 100}%"
        style:background={colors[l]}
        title="{t(`level.${l}`)}: {counts[l]}"
      ></div>
    {/if}
  {/each}
</div>
<div class="legend small">
  {#each LEVELS as l (l)}
    <span><i style:background={colors[l]}></i>{t(`level.${l}`)} {counts[l]}</span>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    height: 18px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--line);
  }
  .bar div {
    transition: width 0.5s ease;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin-top: 8px;
    color: var(--ink-2);
  }
  .legend i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 5px;
  }
</style>
