<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import ProfileForm from '../components/ProfileForm.svelte'
  import { app, createProfile, selectProfile, visibleProfiles } from '../state/app.svelte'
  import { t } from '../state/i18n.svelte'
  import { href, navigate } from '../state/router.svelte'
  import { audio } from '../state/app.svelte'

  const profiles = $derived(visibleProfiles())
  let adding = $state(false)
  const showForm = $derived(adding || profiles.length === 0)

  function pick(id: string) {
    audio.sfx('tap')
    selectProfile(id)
    navigate('')
  }
</script>

<main class="page narrow profiles">
  <div class="hero">
    <img src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="88" height="88" />
    {#if profiles.length === 0}
      <h1>{t('profiles.welcome')}</h1>
      <p class="muted">{t('profiles.welcomeText')}</p>
    {:else}
      <h1>{t('profiles.who')}</h1>
    {/if}
  </div>

  {#if profiles.length}
    <div class="list">
      {#each profiles as p (p.id)}
        <button
          class="profile"
          class:current={p.id === app.save?.profileId}
          style:--c={p.color}
          onclick={() => pick(p.id)}
        >
          <span class="face" aria-hidden="true">{p.avatar}</span>
          <span class="name">{p.name}</span>
        </button>
      {/each}
      {#if !adding}
        <button class="profile add" onclick={() => (adding = true)}>
          <span class="face" aria-hidden="true"><Icon name="plus" size={36} /></span>
          <span class="name">{t('profiles.add')}</span>
        </button>
      {/if}
    </div>
  {/if}

  {#if showForm}
    <div class="panel">
      <ProfileForm
        submitLabel={t('profiles.start')}
        onsubmit={(p) => {
          createProfile(p.name, p.avatar, p.color)
          adding = false
          navigate('')
        }}
        oncancel={profiles.length ? () => (adding = false) : undefined}
      />
    </div>
  {/if}

  {#if profiles.length === 0}
    <p class="muted small center">
      {t('profiles.otherDevice')} <a href={href('parent')}>{t('profiles.connect')}</a>
    </p>
  {/if}
</main>

<style>
  .profiles {
    display: grid;
    gap: 28px;
  }
  .hero {
    display: grid;
    gap: 10px;
    justify-items: center;
    text-align: center;
    padding-top: 24px;
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
  }
  .profile {
    appearance: none;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    display: grid;
    gap: 10px;
    justify-items: center;
    width: 128px;
  }
  .face {
    width: 112px;
    height: 112px;
    border-radius: 32px;
    display: grid;
    place-items: center;
    font-size: 60px;
    background: var(--c, var(--surface-2));
    box-shadow: var(--shadow);
    transition: transform 0.15s;
  }
  .profile:hover .face {
    transform: translateY(-3px) rotate(-3deg);
  }
  .profile.current .face {
    outline: 4px solid var(--ink);
    outline-offset: 3px;
  }
  .profile.add .face {
    background: var(--surface);
    color: var(--ink-2);
    border: 3px dashed var(--line);
    box-shadow: none;
  }
  .name {
    font-weight: 800;
    font-size: 1.15rem;
  }
  .center {
    text-align: center;
  }
</style>
