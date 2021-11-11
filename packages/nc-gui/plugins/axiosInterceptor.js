// import axios from 'axios';
//
// if (!window.axios) {
//   window.axios = axios.create({
//     baseURL: 'http://localhost:8080',
//   });
// }

export default ({ store, $axios, redirect, $toast, route, app }) => {
  // Add a request interceptor
  $axios.interceptors.request.use(function(config) {
    config.headers['xc-gui'] = 'true'
    if (store.state.users.token) {
      config.headers['xc-auth'] = store.state.users.token
    }
    if (!config.url.endsWith('/user/me') && !config.url.endsWith('/admin/roles') && store.state.users.previewAs) {
      config.headers['xc-preview'] = store.state.users.previewAs
    }

    if (!config.url.endsWith('/user/me') && !config.url.endsWith('/admin/roles')) {
      if (app.context && app.context.route && app.context.route.params && app.context.route.params.shared_base_id) {
        config.headers['xc-shared-base-id'] = app.context.route.params.shared_base_id
      }
    }

    return config
  })

  // $axios.setBaseURL('http://localhost:8080')

  $axios.interceptors.response.use((response) => {
    // Return a successful response back to the calling service
    return response
  }, (error) => {
    if (error.response && error.response.data && error.response.data.msg === 'Database config not found') {
      redirect('/project/0')
      return
    }

    // Return any error which is not due to authentication back to the calling service
    if (!error.response || error.response.status !== 401) {
      return new Promise((resolve, reject) => {
        reject(error)
      })
    }

    // Logout user if token refresh didn't work or user is disabled
    if (error.config.url === '/auth/refresh-token') {
      store.dispatch('users/ActSignOut')

      return new Promise((resolve, reject) => {
        reject(error)
      })
    }

    // Try request again with new token
    return $axios.post('/auth/refresh-token', null, {
      withCredentials: true
    })
      .then((token) => {
        console.log(token)
        // New request with new token
        const config = error.config
        config.headers['xc-auth'] = token.data.token
        store.commit('users/MutSetToken', token.data.token)

        return new Promise((resolve, reject) => {
          $axios.request(config).then((response) => {
            resolve(response)
          }).catch((error) => {
            reject(error)
          })
        })
      })
      .catch(async(error) => {
        await store.dispatch('users/ActSignOut')
        if (store.state.project.projectInfo.firstUser) {
          redirect('/')
        } else {
          $toast.clear()
          $toast.info('Token expired please login to continue', {
            position: 'bottom-center'
          }).goAway(5000)
          redirect('/user/authentication/signin')
        }
        Promise.reject(error)
      })
  })
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
