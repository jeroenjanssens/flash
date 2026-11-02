<script lang="ts">
  import { onMount } from 'svelte'
  import Toasts from './components/Toasts.svelte'
  import { app, currentProfile, initApp, startPersistence } from './state/app.svelte'
  import { deckById, decks, loadDecks } from './state/decks.svelte'
  import { t } from './state/i18n.svelte'
  import { route, startRouter } from './state/router.svelte'
  import { startSync } from './state/sync.svelte'
  import Cards from './views/Cards.svelte'
  import DeckPage from './views/Deck.svelte'
  import DeckSettings from './views/DeckSettings.svelte'
  import Flip from './views/Flip.svelte'
  import Home from './views/Home.svelte'
  import Learn from './views/Learn.svelte'
  import Pair from './views/Pair.svelte'
  import Parent from './views/Parent.svelte'
  import Practice from './views/Practice.svelte'
  import Profiles from './views/Profiles.svelte'
  import Race from './views/Race.svelte'
  import Settings from './views/Settings.svelte'
  import Sprint from './views/Sprint.svelte'
  import Stats from './views/Stats.svelte'

  initApp()

  onMount(() => {
    const stops = [startRouter(), startPersistence(), startSync()]
    void loadDecks()
    return () => stops.forEach((stop) => stop())
  })

  const page = $derived(route.segments[0] ?? '')
  const deckId = $derived(page === 'deck' ? route.segments[1] : undefined)
  const sub = $derived(route.segments[2] ?? '')
  const loaded = $derived(deckId ? deckById(deckId) : undefined)
  // Pages that work without a profile.
  const open = $derived(['profiles', 'parent', 'pair'].includes(page))
  const accent = $derived(loaded?.deck.color)
</script>

<div class="app" style:--deck={accent}>
  {#if page === 'pair'}
    <Pair />
  {:else if !open && (!app.save || !currentProfile())}
    <Profiles />
  {:else if page === 'profiles'}
    <Profiles />
  {:else if page === 'parent'}
    <Parent />
  {:else if page === 'settings'}
    <Settings />
  {:else if page === 'learn'}
    {#if decks.loaded}
      {#key JSON.stringify(route.query)}<Learn deckIds={undefined} />{/key}
    {/if}
  {:else if page === 'deck'}
    {#if !decks.loaded}
      <div class="loading" aria-busy="true"></div>
    {:else if !loaded}
      <div class="page narrow missing">
        <h1>{t('deck.notFound')}</h1>
        <a class="btn primary" href="#/">{t('common.home')}</a>
      </div>
    {:else if sub === ''}
      <DeckPage {loaded} />
    {:else if sub === 'learn'}
      {#key JSON.stringify(route.query)}<Learn deckIds={[loaded.deck.id]} />{/key}
    {:else if sub === 'practice'}
      {#key route.segments[3]}
        <Practice
          {loaded}
          mode={route.segments[3] === 'listen'
            ? 'listen'
            : route.segments[3] === 'choose'
              ? 'choose'
              : 'type'}
        />
      {/key}
    {:else if sub === 'flip'}
      <Flip {loaded} />
    {:else if sub === 'sprint'}
      <Sprint {loaded} />
    {:else if sub === 'race'}
      <Race {loaded} />
    {:else if sub === 'cards'}
      <Cards {loaded} />
    {:else if sub === 'stats'}
      <Stats {loaded} />
    {:else if sub === 'settings'}
      <DeckSettings {loaded} />
    {:else}
      <DeckPage {loaded} />
    {/if}
  {:else}
    <Home />
  {/if}
</div>

<Toasts />

<style>
  .app {
    min-height: 100dvh;
  }
  .loading {
    min-height: 60vh;
  }
  .missing {
    display: grid;
    gap: 20px;
    justify-items: start;
  }
</style>
