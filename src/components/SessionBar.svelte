<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../state/i18n.svelte'
  import Icon from './Icon.svelte'

  /** The bar above a running session: stop, progress, and something on the right. */
  let {
    progress,
    onclose,
    right,
    color,
  }: { progress: number; onclose: () => void; right?: Snippet; color?: string } = $props()
</script>

<div class="bar">
  <button
    class="btn icon ghost"
    onclick={onclose}
    aria-label={t('common.stop')}
    title={t('common.stop')}
  >
    <Icon name="close" />
  </button>
  <div
    class="track"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(progress * 100)}
  >
    <div class="fill" style:width="{Math.min(100, progress * 100)}%" style:background={color}></div>
  </div>
  <div class="right">{@render right?.()}</div>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: calc(8px + var(--safe-top)) 12px 8px;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }
  .track {
    flex: 1;
    height: 14px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 0.4s ease;
  }
  .right {
    min-width: 48px;
    text-align: right;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
</style>
