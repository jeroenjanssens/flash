<script lang="ts">
  import { onMount } from 'svelte'
  import { parseRepo } from '../lib/deck/library'
  import { t } from '../state/i18n.svelte'
  import { navigate, replace, route } from '../state/router.svelte'
  import { connect, sync } from '../state/sync.svelte'
  import { toast } from '../state/ui.svelte'

  /** Set up this device from a pairing link: #/pair?t=<token>&g=<gist>&r=<deck repo>. */
  let status = $state<'busy' | 'failed'>('busy')

  onMount(async () => {
    const { t: token, g: gist, r: repo } = route.query
    // Don't leave the token in the address bar or the history.
    replace('pair')
    if (!token) {
      navigate('')
      return
    }
    const ok = await connect(token, gist, repo ? parseRepo(repo) : undefined)
    if (ok) {
      toast(t('pair.done'))
      navigate('profiles')
    } else status = 'failed'
  })
</script>

<main class="page narrow pair">
  <img src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="88" height="88" />
  {#if status === 'busy'}
    <h1>{t('pair.busy')}</h1>
  {:else}
    <h1>{t('pair.failed')}</h1>
    <p class="muted">{t(`sync.error.${sync.error || 'http'}`)}</p>
    <a class="btn primary" href="#/">{t('common.home')}</a>
  {/if}
</main>

<style>
  .pair {
    display: grid;
    gap: 16px;
    justify-items: center;
    text-align: center;
    padding-top: 15vh;
  }
</style>
