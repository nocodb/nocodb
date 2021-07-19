import createPersistedState from 'vuex-persistedstate'

// var authRoute = require('../components/auth.routes');
// var pollStarted = false;
import SecureLS from 'secure-ls'
import isDev from '../helpers/xutils'

// const jExcelDark = {
//   '--jexcel_header_color': '#888',
//   '--jexcel_header_color_highlighted': '#444',
//   '--jexcel_header_background': '#313131',
//   '--jexcel_header_background_highlighted': '#777',
//   '--jexcel_content_color': '#777',
//   '--jexcel_content_color_highlighted': '#333',
//   '--jexcel_content_background': '#3e3e3e',
//   '--jexcel_content_background_highlighted': '#333',
//   '--jexcel_menu_background': '#7e7e7e',
//   '--jexcel_menu_background_highlighted': '#ebebeb',
//   '--jexcel_menu_color': '#ddd',
//   '--jexcel_menu_color_highlighted': '#222',
//   '--jexcel_menu_box_shadow': 'unset',
//   '--jexcel_border_color': '#5f5f5f',
//   '--jexcel_border_color_highlighted': '#999',
//   '--jexcel_cursor': '#333',
//   '--active_color': '#eee'
// };
//
//
// const jExcelLight = {
//   '--jexcel_header_color': '#000',
//   '--jexcel_header_color_highlighted': '#000',
//   '--jexcel_header_background': '#f3f3f3',
//   '--jexcel_header_background_highlighted': '#dcdcdc',
//   '--jexcel_content_color': '#000',
//   '--jexcel_content_color_highlighted': '#000',
//   '--jexcel_content_background': '#fff',
//   '--jexcel_content_background_highlighted': 'rgba(0,0,0,0.05)',
//   '--jexcel_menu_background': '#fff',
//   '--jexcel_menu_background_highlighted': '#ebebeb',
//   '--jexcel_menu_color': '#555',
//   '--jexcel_menu_color_highlighted': '#555',
//   '--jexcel_menu_box_shadow': '2px 2px 2px 0px rgba(143, 144, 145, 1)',
//   '--jexcel_border_color': '#ccc',
//   '--jexcel_border_color_highlighted': '#000',
//   '--jexcel_cursor': '#eee',
//   '--active_color': '#007aff'
// };

const ls = new SecureLS({ isCompression: false })

// function toggleJexcelTheme(isDark) {
//   const bodyStyles = document.body.style;
//   if (isDark) {
//     Object.entries(jExcelDark).forEach(([k, v]) => {
//       bodyStyles.setProperty(k, v);
//     })
//   } else {
//     Object.entries(jExcelLight).forEach(([k, v]) => {
//       bodyStyles.setProperty(k, v);
//     })
//   }
// }

export default async({ store, $vuetify: { theme } }) => {
  /**
   *
   */
  store.watch(
    state => state.windows.theme,
    (c) => {
      // console.log(JSON.stringify(themes.dark,0,3))
      // console.log(JSON.stringify(themes.light,0,3))
      theme.themes.dark = { ...theme.themes.dark, ...c }
      theme.themes.light = { ...theme.themes.light, ...c }
    }
  )
  store.watch(
    state => state.windows.darkTheme,
    (isDark) => {
      // if (isDark && !store.state.users.ui_ability.rules.darkTheme) setTimeout(() => store.commit('windows/MutToggleDarkMode', false), 10000)
      theme.dark = isDark
      // toggleJexcelTheme(isDark);;
      document.body.classList.add(isDark ? 'dark' : 'light')
      document.body.classList.remove(isDark ? 'light' : 'dark')
    }
  )
  document.body.classList.add(store.state.windows.darkTheme ? 'dark' : 'light')
  document.body.classList.remove(store.state.windows.darkTheme ? 'light' : 'dark')
  // toggleJexcelTheme(store.state.windows.darkTheme);

  // In case of HMR, mutation occurs before nuxReady, so previously saved state
  // gets replaced with original state received from server. So, we've to skip HMR.
  // Also nuxtReady event fires for HMR as well, which results multiple registration of
  // vuex-persistedstate plugin
  // if (isHMR) return
  //
  // if (process.client) {
  //
  //   window.onNuxtReady(async (nuxt) => {

  createPersistedState({
    fetchBeforeUse: true,
    async rehydrated(store) {
      window.rehydrated = true
      console.log(store.state.windows)
      console.log('Date difference ', await store.dispatch('windows/ActGetExpiryDate'))
    },
    paths: ['users', 'sqlClient', 'apiClient', 'panelSize', 'windows', 'graphqlClient', 'apiClientSwagger'],
    ...(
      isDev()
        ? {}
        : {
            storage: {
              getItem: key => ls.get(key),
              setItem: (key, value) => ls.set(key, value),
              removeItem: key => ls.remove(key)
            }
          }
    )
  })(store) // vuex plugins can be connected to store, even after creation

  // POLLING
  //     // console.log(pollStarted)
  //     if (!pollStarted) {
  //       console.log('Starting poll action')
  //       await store.dispatch('users/ActPollSession');
  //       console.log('updating polling state')
  //       pollStarted = true;
  //     }
  //
  //
  //     if (process.client && store.getters['users/GtrUser'] === null) {
  //
  //       console.log('Plugin in client: user data is null');
  //
  //       //if (authRoute.allowed(store, store.$router.history.current.path) === true) {
  //       if (1) {
  //         console.log('Plugin in client: URL has free access - do nothing');
  //       } else {
  //
  //         console.log('Plugin in client: URL has auth access - get user since sometimes its not filled in');
  //
  //         let user = await store.$axios.get('/users/me');
  //
  //         if (user && user.data) {
  //           console.log('setting user data + + + + +', user);
  //           store.commit('MutSetUser', user.data);
  //         } else {
  //           console.log('User is null - should not have occured', user);
  //         }
  //
  //         if (authRoute.allowed(store, store.$router.history.current.path) === false) {
  //           //console.log(store.$router.history.current.path, 'not allowed without login - redirecting to /');
  //           store.$router.push('/');
  //         }
  //       }
  //
  //     } else {
  //       console.log('Plugin in client: user is present');
  //     }
  //

  // })
  // }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
