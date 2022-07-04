// plugins/i18n.js

import { defineNuxtPlugin } from 'nuxt/app'
import { createI18n } from 'vue-i18n'

// Tell Vue to use our plugin

export default defineNuxtPlugin(async (nuxtApp) => {
  // Set the i18n instance on app
  // This way we can use it globally in our components through this.$i18n
  nuxtApp.vueApp.i18n = createI18n({
    // Set the initial locale
    locale: 'en', // store.state.settings.language,

    // Set the fallback locale in case the current locale can't be found
    fallbackLocale: 'en',
    allowComposition: true,
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

  nuxtApp.vueApp.use(nuxtApp.vueApp.i18n)
  // store.watch(
  //   state => state.settings.language,
  //   (language) => {
  //     if (app.i18n.availableLocales.includes(language))
  //       app.i18n.locale = language
  //   },
  // )
})
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Sebastien Gellet <sebastien.gellet@gmail.com>
 * @author Alejandro Moreno <info@pixplix.com>
 * @author Bruno Moreira <arq.bruno.moreira@gmail.com>

 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
