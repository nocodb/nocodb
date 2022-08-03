// plugins/i18n.js

import Vue from 'vue'
import VueI18n from 'vue-i18n'

// Tell Vue to use our plugin
Vue.use(VueI18n)

export default ({ app, store }) => {
  // Set the i18n instance on app
  // This way we can use it globally in our components through this.$i18n
  app.i18n = new VueI18n({
    // Set the initial locale
    locale: store.state.settings.language,

    // Set the fallback locale in case the current locale can't be found
    fallbackLocale: 'en',

    // Associate each locale to a content file
    messages: {
      en: require('~/lang/en.json'),
      zh_HK: require('~/lang/zh_HK.json'),
      zh_TW: require('~/lang/zh_TW.json'),
      zh_CN: require('~/lang/zh_CN.json'),
      ja: require('~/lang/ja.json'),
      fr: require('~/lang/fr.json'),
      es: require('~/lang/es.json'),
      de: require('~/lang/de.json'),
      id: require('~/lang/id.json'),
      it_IT: require('~/lang/it_IT.json'),
      ko: require('~/lang/ko.json'),
      lv: require('~/lang/lv.json'),
      nl: require('~/lang/nl.json'),
      ru: require('~/lang/ru.json'),
      sv: require('~/lang/sv.json'),
      da: require('~/lang/da.json'),
      vi: require('~/lang/vi.json'),
      no: require('~/lang/no.json'),
      iw: require('~/lang/iw.json'),
      fi: require('~/lang/fi.json'),
      uk: require('~/lang/uk.json'),
      hr: require('~/lang/hr.json'),
      th: require('~/lang/th.json'),
      sl: require('~/lang/sl.json'),
      pt_BR: require('~/lang/pt_BR.json'),
      fa: require('~/lang/fa.json'),
      tr: require('~/lang/tr.json'),
      hi: require('~/lang/hi.json'),
      bn: require('~/lang/bn.json'),
      ar: require('~/lang/ar.json')
    }
  })

  store.watch(
    state => state.settings.language,
    (language) => {
      if (app.i18n.availableLocales.includes(language)) {
        app.i18n.locale = language
      }
    }
  )
}
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
