import { createI18n } from 'vue-i18n'
import { isClient } from '@vueuse/core'
import { LanguageAlias, applyLanguageDirection, defineNuxtPlugin, isEeUI, isRtlLang, nextTick } from '#imports'
import type { Language, NocoI18n } from '#imports'

let globalI18n: NocoI18n

export const createI18nPlugin = async (): Promise<NocoI18n> =>
  createI18n({
    locale: 'en', // Set the initial locale

    fallbackLocale: 'en', // Set the fallback locale in case the current locale can't be found

    legacy: false, // disable legacy API (we use the composition API and inject utilities)

    globalInjection: true, // enable global injection, so all utilities are injected into all components
  })

export const getI18n = () => globalI18n

export async function setI18nLanguage(locale: keyof typeof Language, i18n = globalI18n) {
  if (!i18n.global.availableLocales.includes(locale)) {
    await loadLocaleMessages(locale)
  }

  i18n.global.locale.value = locale

  if (isClient) applyLanguageDirection(isRtlLang(locale) ? 'rtl' : 'ltr')
}

export async function loadLocaleMessages(
  locale: keyof typeof Language | keyof typeof LanguageAlias,
  i18n: NocoI18n = globalI18n,
) {
  if (Object.keys(LanguageAlias).includes(locale)) locale = LanguageAlias[locale as keyof typeof LanguageAlias]

  // load locale messages with dynamic import
  const messages = await import(`../lang/${locale}.json`)

  // set locale and locale message
  i18n.global.setLocaleMessage(locale, messages.default)

  return nextTick()
}

const i18nPlugin = async (nuxtApp) => {
  globalI18n = await createI18nPlugin()

  nuxtApp.vueApp.i18n = globalI18n

  nuxtApp.vueApp.use(globalI18n)
}

export default defineNuxtPlugin(async function (nuxtApp) {
  if (!isEeUI) return await i18nPlugin(nuxtApp)
})

export { i18nPlugin }
