<script lang="ts">
  import type { Snippet } from 'svelte'

  /** A progress ring; `value` from 0 to 1. */
  let {
    value,
    size = 64,
    stroke = 8,
    color = 'var(--accent)',
    children,
  }: {
    value: number
    size?: number
    stroke?: number
    color?: string
    children?: Snippet
  } = $props()

  const r = $derived((size - stroke) / 2)
  const c = $derived(2 * Math.PI * r)
</script>

<div class="ring" style:width="{size}px" style:height="{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle
      cx={size / 2}
      cy={size / 2}
      {r}
      fill="none"
      stroke="var(--line)"
      stroke-width={stroke}
    />
    <circle
      cx={size / 2}
      cy={size / 2}
      {r}
      fill="none"
      stroke={color}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  <div class="inner">{@render children?.()}</div>
</div>

<style>
  .ring {
    position: relative;
    flex: none;
  }
  circle {
    transition: stroke-dashoffset 0.6s ease;
  }
  .inner {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-weight: 800;
  }
</style>
