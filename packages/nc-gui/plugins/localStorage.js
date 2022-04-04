import isDev from '../helpers/xutils'

export default async({ store, $vuetify: { theme }, route }) => {
  /**
   *
   */
  store.watch(
    state => state.windows.theme,
    (c) => {
      theme.themes.dark = { ...theme.themes.dark, ...c }
      theme.themes.light = { ...theme.themes.light, ...c }
    }
  )
  store.watch(
    state => state.windows.darkTheme,
    (isDark) => {
      theme.dark = isDark
      document.body.classList.add(isDark ? 'dark' : 'light')
      document.body.classList.remove(isDark ? 'light' : 'dark')
    }
  )
  document.body.classList.add(store.state.windows.darkTheme ? 'dark' : 'light')
  document.body.classList.remove(store.state.windows.darkTheme ? 'light' : 'dark')

  // In case of HMR, mutation occurs before nuxReady, so previously saved state
  // gets replaced with original state received from server. So, we've to skip HMR.
  // Also nuxtReady event fires for HMR as well, which results multiple registration of
  // vuex-persistedstate plugin
  // if (isHMR) return
  //
  // if (process.client) {
  //
  //   window.onNuxtReady(async (nuxt) => {
  if (route && route.query && 'embed' in route.query) {
    window.rehydrated = true
    store.commit('mutEmbed', true)
  } else {
    const createPersistedState = (await import('vuex-persistedstate')).default
    const SecureLS = (await import('secure-ls')).default
    const ls = new SecureLS({ isCompression: false })

    createPersistedState({
      fetchBeforeUse: true,
      async rehydrated(store) {
        window.rehydrated = true
      },
      paths: ['users', 'sqlClient', 'apiClient', 'panelSize', 'windows', 'graphqlClient', 'apiClientSwagger', 'app'],
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
  }
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
