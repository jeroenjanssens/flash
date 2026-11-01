<script lang="ts">
  import { currentProfile } from '../state/app.svelte'
  import { t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import { sync, syncNow } from '../state/sync.svelte'
  import { toast } from '../state/ui.svelte'
  import Icon from './Icon.svelte'

  let { back, title }: { back?: string; title?: string } = $props()
  const profile = $derived(currentProfile())

  async function manualSync() {
    const ok = await syncNow()
    toast(ok ? t('sync.done') : t(`sync.error.${sync.error || 'http'}`), ok ? 'info' : 'error')
  }
</script>

<header class="header">
  {#if back}
    <a class="btn icon ghost" href={back} aria-label={t('common.back')}><Icon name="back" /></a>
  {:else}
    <a class="logo" href={href('')} aria-label={t('nav.home')}>
      <img src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="36" height="36" />
      <span>Flash</span>
    </a>
  {/if}
  <h2 class="title">{title ?? ''}</h2>
  <div class="row end">
    {#if sync.connected}
      <button
        class="btn icon ghost"
        class:spin={sync.syncing}
        class:error={!!sync.error}
        onclick={manualSync}
        aria-label={t('sync.now')}
        title={t('sync.now')}
      >
        <Icon name="sync" />
      </button>
    {/if}
    {#if profile}
      <a
        class="avatar"
        href={href('profiles')}
        style:background={profile.color}
        title={t('nav.switch')}
      >
        <span aria-hidden="true">{profile.avatar}</span>
        <span class="sr-only">{profile.name} — {t('nav.switch')}</span>
      </a>
      <a
        class="btn icon ghost"
        href={href('settings')}
        aria-label={t('nav.settings')}
        title={t('nav.settings')}
      >
        <Icon name="gear" />
      </a>
    {/if}
  </div>
</header>

<style>
  .header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
    margin-bottom: 20px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 900;
    font-size: 1.35rem;
    text-decoration: none;
    letter-spacing: -0.02em;
  }
  .title {
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .end {
    gap: 6px;
    flex-wrap: nowrap;
  }
  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 24px;
    text-decoration: none;
    box-shadow: var(--shadow);
  }
  .spin :global(svg) {
    animation: spin 1s linear infinite;
  }
  .error {
    color: var(--bad);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
