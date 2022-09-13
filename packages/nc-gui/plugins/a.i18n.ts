import { defineNuxtPlugin } from 'nuxt/app'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import type { NocoI18n } from '~/lib'

let globalI18n: NocoI18n

export const createI18nPlugin = async (): Promise<NocoI18n> =>
  createI18n({
    locale: 'en', // Set the initial locale

    fallbackLocale: 'en', // Set the fallback locale in case the current locale can't be found

    legacy: false, // disable legacy API (we use the composition API and inject utilities)

    globalInjection: true, // enable global injection, so all utilities are injected into all components
  })

export const getI18n = () => globalI18n

export function setI18nLanguage(i18n: NocoI18n, locale: string): void {
  i18n.global.locale.value = locale
}

export async function loadLocaleMessages(i18n: NocoI18n, locale: string) {
  // load locale messages with dynamic import
  const messages = await import(`../lang/${locale}.json`)

  // set locale and locale message
  i18n.global.setLocaleMessage(locale, messages.default)

  return nextTick()
}

export default defineNuxtPlugin(async (nuxtApp) => {
  globalI18n = await createI18nPlugin()

  nuxtApp.vueApp.i18n = globalI18n

  nuxtApp.vueApp.use(globalI18n)
})
