import { defineNuxtPlugin } from 'nuxt/app'
import { createI18n } from 'vue-i18n'

let i18n: ReturnType<typeof createI18n>

export const createI18nPlugin = async () =>
  createI18n({
    locale: 'en', // Set the initial locale

    fallbackLocale: 'en', // Set the fallback locale in case the current locale can't be found

    legacy: false, // disable legacy API (we use the composition API and inject utilities)

    globalInjection: true, // enable global injection, so all utilities are injected into all components

    // Associate each locale to a content file
    messages: {
      ar: await import('~/lang/ar.json'),
      bn_IN: await import('~/lang/bn_IN.json'),
      da: await import('~/lang/da.json'),
      de: await import('~/lang/de.json'),
      en: await import('~/lang/en.json'),
      es: await import('~/lang/es.json'),
      fa: await import('~/lang/fa.json'),
      fi: await import('~/lang/fi.json'),
      fr: await import('~/lang/fr.json'),
      he: await import('~/lang/he.json'),
      hi: await import('~/lang/hi.json'),
      hr: await import('~/lang/hr.json'),
      id: await import('~/lang/id.json'),
      it: await import('~/lang/it.json'),
      ja: await import('~/lang/ja.json'),
      ko: await import('~/lang/ko.json'),
      lv: await import('~/lang/lv.json'),
      nl: await import('~/lang/nl.json'),
      no: await import('~/lang/no.json'),
      pl: await import('~/lang/pl.json'),
      pt: await import('~/lang/pt.json'),
      pt_BR: await import('~/lang/pt_BR.json'),
      ru: await import('~/lang/ru.json'),
      sv: await import('~/lang/sv.json'),
      sl: await import('~/lang/sl.json'),
      th: await import('~/lang/th.json'),
      tr: await import('~/lang/tr.json'),
      uk: await import('~/lang/uk.json'),
      vi: await import('~/lang/vi.json'),
      zh_Hans: await import('~/lang/zh-Hans.json'),
      zh_Hant: await import('~/lang/zh-Hant.json'),
    },
  })

export default defineNuxtPlugin(async (nuxtApp) => {
  i18n = (await createI18nPlugin()) as any

  nuxtApp.vueApp.i18n = i18n.global as any

  nuxtApp.vueApp.use(i18n)
})

export const getI18n = () => i18n
