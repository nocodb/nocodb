import { defineNuxtPlugin } from 'nuxt/app'
import { createI18n } from 'vue-i18n'

export const createI18nPlugin = async () =>
  createI18n({
    locale: 'en', // Set the initial locale

    fallbackLocale: 'en', // Set the fallback locale in case the current locale can't be found

    legacy: false, // disable legacy API (we use the composition API and inject utilities)

    globalInjection: true, // enable global injection, so all utilities are injected into all components

    // Associate each locale to a content file
    messages: {
      en: await import('~/lang/en.json'),
      zh_HK: await import('~/lang/zh_HK.json'),
      zh_TW: await import('~/lang/zh_TW.json'),
      zh_CN: await import('~/lang/zh_CN.json'),
      ja: await import('~/lang/ja.json'),
      fr: await import('~/lang/fr.json'),
      es: await import('~/lang/es.json'),
      de: await import('~/lang/de.json'),
      id: await import('~/lang/id.json'),
      it_IT: await import('~/lang/it_IT.json'),
      ko: await import('~/lang/ko.json'),
      lv: await import('~/lang/lv.json'),
      nl: await import('~/lang/nl.json'),
      ru: await import('~/lang/ru.json'),
      sv: await import('~/lang/sv.json'),
      da: await import('~/lang/da.json'),
      vi: await import('~/lang/vi.json'),
      no: await import('~/lang/no.json'),
      iw: await import('~/lang/iw.json'),
      fi: await import('~/lang/fi.json'),
      uk: await import('~/lang/uk.json'),
      hr: await import('~/lang/hr.json'),
      th: await import('~/lang/th.json'),
      sl: await import('~/lang/sl.json'),
      pt_BR: await import('~/lang/pt_BR.json'),
      fa: await import('~/lang/fa.json'),
      tr: await import('~/lang/tr.json'),
    },
  })

export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = await createI18nPlugin()

  nuxtApp.vueApp.i18n = i18n.global

  nuxtApp.vueApp.use(i18n)
})
