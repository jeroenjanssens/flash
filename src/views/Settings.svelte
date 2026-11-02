<script lang="ts">
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import ProfileForm from '../components/ProfileForm.svelte'
  import Segmented from '../components/Segmented.svelte'
  import type { AnswerStyle, Settings, Theme, VoiceSetting } from '../lib/storage/schema'
  import { currentProfile, save, updateProfile, updateSettings } from '../state/app.svelte'
  import { t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import { toast } from '../state/ui.svelte'

  const s = $derived(save().settings)
  const profile = $derived(currentProfile()!)

  /** A setting bound to the learner's settings, saved and synced on change. */
  function bind<K extends keyof Settings>(key: K) {
    return {
      get value() {
        return s[key]
      },
      set value(v: Settings[K]) {
        updateSettings({ [key]: v } as Partial<Settings>)
      },
    }
  }
  const language = bind('language')
  const voice = bind('voice')
  const theme = bind('theme')
  const answerStyle = bind('answerStyle')
  const dailyGoal = bind('dailyGoal')
  const newPerDay = bind('newPerDay')
  const sessionSize = bind('sessionSize')
</script>

<main class="page narrow">
  <Header back={href('')} title={t('nav.settings')} />
  <div class="stack">
    <section class="panel">
      {#key profile.id}
        <ProfileForm
          name={profile.name}
          avatar={profile.avatar}
          color={profile.color}
          submitLabel={t('common.save')}
          onsubmit={(p) => {
            updateProfile(profile.id, p)
            toast(t('settings.saved'))
          }}
        />
      {/key}
    </section>

    <section class="panel stack">
      <h2>{t('settings.learning')}</h2>
      <div class="setting">
        <span>{t('settings.answerStyle')}</span>
        <Segmented
          label={t('settings.answerStyle')}
          bind:value={answerStyle.value}
          options={(['auto', 'type', 'choose', 'flip'] as AnswerStyle[]).map((v) => ({
            value: v,
            label: t(`settings.style.${v}`),
          }))}
        />
        <p class="muted small">{t(`settings.style.${s.answerStyle}Text`)}</p>
      </div>
      <label class="field">
        {t('settings.newPerDay')}
        <input class="input" type="number" min="0" max="100" bind:value={newPerDay.value} />
      </label>
      <label class="field">
        {t('settings.sessionSize')}
        <input class="input" type="number" min="5" max="200" bind:value={sessionSize.value} />
      </label>
      <label class="field">
        {t('settings.dailyGoal')}
        <input class="input" type="number" min="5" max="500" bind:value={dailyGoal.value} />
      </label>
    </section>

    <section class="panel stack">
      <h2>{t('settings.sound')}</h2>
      <div class="setting">
        <span>{t('settings.voice')}</span>
        <Segmented
          label={t('settings.voice')}
          bind:value={voice.value}
          options={(['female', 'male', 'random'] as VoiceSetting[]).map((v) => ({
            value: v,
            label: t(`settings.voice.${v}`),
          }))}
        />
      </div>
      <label class="switch">
        <span>{t('settings.autoplay')}</span>
        <input
          type="checkbox"
          checked={s.autoplay}
          onchange={(e) => updateSettings({ autoplay: e.currentTarget.checked })}
        />
      </label>
      <label class="switch">
        <span>{t('settings.sounds')}</span>
        <input
          type="checkbox"
          checked={s.sounds}
          onchange={(e) => updateSettings({ sounds: e.currentTarget.checked })}
        />
      </label>
    </section>

    <section class="panel stack">
      <h2>{t('settings.looks')}</h2>
      <div class="setting">
        <span>{t('settings.language')}</span>
        <Segmented
          label={t('settings.language')}
          bind:value={language.value}
          options={[
            { value: 'nl', label: 'Nederlands' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <div class="setting">
        <span>{t('settings.theme')}</span>
        <Segmented
          label={t('settings.theme')}
          bind:value={theme.value}
          options={(['system', 'light', 'dark'] as Theme[]).map((v) => ({
            value: v,
            label: t(`settings.theme.${v}`),
          }))}
        />
      </div>
    </section>

    <a class="btn" href={href('parent')}><Icon name="user" />{t('nav.parent')}</a>
  </div>
</main>

<style>
  .setting {
    display: grid;
    gap: 8px;
    font-weight: 700;
  }
</style>
