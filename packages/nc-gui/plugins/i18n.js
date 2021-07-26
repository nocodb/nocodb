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
    locale: store.state.windows.language,

    // Set the fallback locale in case the current locale can't be found
    fallbackLocale: 'en',

    // Associate each locale to a content file
    messages: {
      en: require('~/static/lang/en.json'),
      zh: require('~/static/lang/zh.json'),
      // ja: require("~/static/lang/ja.json"),
      fr: require('~/static/lang/fr.json'),
      es: require('~/static/lang/es.json'),
      pt: require('~/static/lang/pt.json')
    }
  })

  store.watch(
    state => state.windows.language,
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
