<script lang="ts">
  import { addDays, dayKey } from '../../lib/time'
  import { formatDate, t } from '../../state/i18n.svelte'

  /** Practice per day for the last `weeks` weeks, GitHub style. */
  let { days, weeks = 18 }: { days: Map<string, number>; weeks?: number } = $props()

  const cells = $derived.by(() => {
    const today = dayKey(Date.now())
    const weekday = (new Date().getDay() + 6) % 7 // Monday = 0
    const start = addDays(today, -(weeks - 1) * 7 - weekday)
    const out: { day: string; count: number; col: number; row: number }[] = []
    for (let i = 0; i < weeks * 7; i++) {
      const day = addDays(start, i)
      if (day > today) break
      out.push({ day, count: days.get(day) ?? 0, col: Math.floor(i / 7), row: i % 7 })
    }
    return out
  })
  const max = $derived(Math.max(1, ...cells.map((c) => c.count)))
  const size = 14
  const gap = 3
</script>

<svg
  class="heatmap"
  viewBox="0 0 {weeks * (size + gap)} {7 * (size + gap)}"
  role="img"
  aria-label={t('stats.activity')}
>
  {#each cells as c (c.day)}
    <rect
      x={c.col * (size + gap)}
      y={c.row * (size + gap)}
      width={size}
      height={size}
      rx="3.5"
      fill={c.count ? 'var(--good)' : 'var(--line)'}
      fill-opacity={c.count ? 0.3 + 0.7 * (c.count / max) : 1}
    >
      <title>{formatDate(c.day, { day: 'numeric', month: 'short' })}: {c.count}</title>
    </rect>
  {/each}
</svg>

<style>
  .heatmap {
    width: 100%;
    max-width: 520px;
    height: auto;
  }
</style>
