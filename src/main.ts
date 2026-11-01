import '@fontsource-variable/nunito'
import '@fontsource/andika/latin-400.css'
import '@fontsource/andika/latin-700.css'
import './styles/app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { registerPwa } from './lib/pwa'
import { t } from './state/i18n.svelte'
import { session, toast } from './state/ui.svelte'

mount(App, { target: document.getElementById('app')! })
document.getElementById('boot')?.remove()

void registerPwa({
  // A new version: switch to it as soon as no session is running (never in the middle of one).
  onNeedRefresh: (update) => {
    const wait = setInterval(() => {
      if (session.active) return
      clearInterval(wait)
      toast(t('misc.updating'), 'info', 0)
      void update()
    }, 1000)
  },
  onOfflineReady: () => toast(t('misc.offlineReady')),
})
