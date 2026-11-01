<script lang="ts">
  import { dismiss, toasts } from '../state/ui.svelte'
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.list as toast (toast.id)}
    <button class="toast" class:error={toast.kind === 'error'} onclick={() => dismiss(toast.id)}>
      {toast.text}
    </button>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    bottom: calc(20px + var(--safe-bottom));
    transform: translateX(-50%);
    display: grid;
    gap: 8px;
    z-index: 60;
    width: min(92vw, 420px);
  }
  .toast {
    appearance: none;
    border: 0;
    font: inherit;
    font-weight: 700;
    text-align: left;
    padding: 14px 18px;
    border-radius: 16px;
    background: var(--ink);
    color: var(--bg);
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    animation: up 0.25s ease;
  }
  .toast.error {
    background: var(--bad);
    color: white;
  }
  @keyframes up {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
</style>
