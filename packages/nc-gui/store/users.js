// this.$axios.defaults.withCredentials = true;

// resourceState
import rolePermissionsCE from '@/helpers/rolePermissions'
import rolePermissionsEE from '@/helpers/rolePermissionsEE'

export const state = () => ({

  // resourceList : []
  user: null,
  counter: 0,
  social_auth_called: false,
  paidUser: false,
  ui_ability: {
    rules: {
      darkTheme: true,
      maxTables: 99999,
      maxTabs: 99,
      disableGA: false,
      disableTelemetry: false
    }
  },
  token: null,
  authType: null,
  masterKey: null,
  previewAs: null,
  projectRole: {}
})

// modified state vars
export const getters = {

  GtrCounter(state) {
    return state.counter
  },

  GtrUser(state) {
    return state.user
  },
  GtrToken(state) {
    return state.token
  },

  GtrSocialAuthCalled(state) {
    return state.social_auth_called
  },

  GtrPaidUser(state) {
    return state.paidUser
  },

  GtrIsAuthenticated(state) {
    return state.user
  },

  GtrIsAdmin(state) {
    // return (state.authType === 'jwt' && state.user && state.user.roles && (state.user.roles.creator || state.user.roles.owner)) || (state.authType === 'masterKey' && state.masterKey) || state.authType === 'none'
    return (state.user && state.user.roles && (state.user.roles.creator || state.user.roles.owner)) ||
      (state.projectRole && (state.projectRole.creator || state.projectRole.owner))
  },

  GtrIsUIAllowed(state) {
    // eslint-disable-next-line no-unused-vars
    const rolePermissions = process.env.EE ? rolePermissionsEE : rolePermissionsCE
    return (page, ignorePreviewAs = false) => {
      const user = state.user
      let roles = {
        ...((user && user.roles) || {}),
        ...(state.projectRole || {})
      }

      if (state.previewAs && !ignorePreviewAs) {
        roles = {
          [state.previewAs]: true
        }
      }
      return Object.entries(roles).some(([name, hasRole]) => {
        // todo : revert
        // return true
        return hasRole && rolePermissions[name] && (rolePermissions[name] === '*' || rolePermissions[name][page])
      })
    }
  },

  GtrRole(state) {
    return state.user && state.user.roles && (['owner',
      'creator',
      'editor',
      'viewer'].find(r => state.user.roles[r]) || Object.keys(state.user.roles)[0])
  },

  GtrUserEmail(state) {
    if (state.user && state.user.email) { return state.user.email } else { return '' }
  }

}

// state variables are modified here
export const mutations = {

  MutSetUser(state, user) {
    // console.log('in MutPlusCounter', user);

    state.user = user && user.email ? user : null
  },
  MutProjectRole(state, role) {
    // console.log('in MutPlusCounter', user);

    state.projectRole = role
  },
  MutSetToken(state, token) {
    state.token = token
  },
  MutUiAbility(state, uiAbility) {
    state.ui_ability = uiAbility
  },

  MutSetSocialAuthCalled(state, called) {
    state.social_auth_called = called
  },

  MutSetProjectToNull(state) {
    state.project = null
    state.projectTree = null
  },

  MutSetPaidUser(state, isPaid) {
    state.paidUser = isPaid
  },

  MutAuthType(state, authType) {
    state.authType = authType
  },

  MutMasterKey(state, masterKey) {
    state.masterKey = masterKey
  },
  MutPreviewAs(state, previewAs) {
    state.previewAs = previewAs
  }

}

// mutation are performed via actions
export const actions = {

  ActPlusCounter({ commit }) {
    // console.log('in action');
    commit('MutPlusCounter')
  },

  ActPollSession({ commit, getters, rootGetters }, todo) {
    setInterval(async() => {
      if (getters.GtrUser) {
        try {
          const res = await this.$api.auth.me() // this.$axios.get('/user/me')
          if (res === null || !res.email) {
            commit('MutSetUser', null)
          } else {
            commit('MutSetUser', res)
          }
          commit('windows/MutPollingSet', 0, { root: true })
        } catch (e) {
          if (e.response.status === 504) {
            commit('windows/MutPollingIncrementBy', 1, { root: true })

            if (rootGetters['windows/GtrMaxPollingRetryExceeded']) {
              commit('MutSetUser', null)
              commit('windows/MutPollingSet', 0, { root: true })
            }
          } else {
            commit('MutSetUser', null)
            commit('windows/MutPollingSet', 0, { root: true })
          }
        }
      } else {
      }
    }, process.env.pollingInterval)
  },

  async ActNewRefferalLink({ state, commit }) {
    // console.log('ActNewRefferalLink');
    try {
      const profits = await this.$axios.post('/referral')
      // console.log(profits);
      return profits.data
    } catch (e) {
      console.log('error', e)
      return e
    }
  },

  async ActGetUrl({ state, commit }, urlParamObj) {
    // console.log('url:', urlParamObj['url']);
    // console.log('params:', urlParamObj['params']);
    try {
      const value = await this.$axios.get(urlParamObj.url, { params: urlParamObj.params })
      // console.log(value);
      return value.data
    } catch (e) {
      console.log('error in get url:', urlParamObj, e)
      return e
    }
  },

  async ActPostUrl({ state, commit }, urlParamObj) {
    try {
      const value = await this.$axios.post(urlParamObj.url, urlParamObj.body)
      // console.log(value);
      return value.data
    } catch (e) {
      console.log('error in post url:', e.response)
      return e.response
    }
  },

  /** ************** START : authentication ****************/
  async ActSignUp({ commit, dispatch }, data) {
    let err = null
    try {
      if (!data.ignore_subscribe) {
        delete data.ignore_subscribe
      }

      const userRes = await this.$api.auth.signup(data)

      commit('MutSetToken', userRes.token)

      await dispatch('ActGetUserDetails')
    } catch (e) {
      console.log('ActSignUp error', e.response)
      err = e.response
    }

    return err
  },

  async ActSignIn({ commit, dispatch }, data) {
    // console.log('in action signin');
    let err = null
    try {

      const userPromise = await this.$api.auth.signin(data)

      commit('MutSetToken', userPromise.token)

      await dispatch('ActGetUserDetails')
    } catch (e) {
      err = e.response
    }
    console.log('err', err)
    return err
  },

  async ActSignOut({ commit, state }) {
    let err = null

    try {
      // todo: sdk
      commit('MutSetUser', null)
      commit('MutSetToken', null)
      commit('MutMasterKey', null)
      commit('MutAuthType', null)
    } catch (e) {
      err = e
      console.log(e)
    }

    return err
  },
  /** ************** END : authentication ****************/

  async ActGetUserDetails({ commit, state }) {
    try {
      const user = await this.$api.auth.me({ // await this.$axios.get('/user/me', {
        headers: {
          'xc-auth': state.token
        }
      })
      commit('MutSetUser', user)
    } catch (e) {
      console.log('ignoring user/me error')
    }
  },

  async ActGetProjectUserDetails({ commit, state }, projectId) {
    try {
      const user = await this.$api.auth.me({ // '/user/me?project_id=' + projectId, {
        headers: {
          'xc-auth': state.token
        },
        query: { project_id: projectId }
      })
      commit('MutProjectRole', user && user.roles)
    } catch (e) {
      console.log('ignoring user/me error')
    }
  },
  async ActGetBaseUserDetails({ commit, state }, sharedBaseId) {
    try {
      try {
        const user = await this.$api.auth.me({ // '/user/me', {
          headers: {
            'xc-shared-base-id': sharedBaseId
          }
        })
        commit('MutProjectRole', user && user.roles)
      } catch (e) {
        console.log('ignoring user/me error')
      }
    } catch (e) {
      console.log('ignoring user/me error')
    }
  },

  async ActGetUserUiAbility({ commit, state }) {
    try {
      const uiAbility = await this.$axios.get('/ui_ability')

      let changed = false
      if (!state.ui_ability.rules.darkTheme && uiAbility.data.rules.darkTheme) {
        this.$toast.success('Ho Yes! Dark theme has been enabled for your profile!').goAway(5000)
        changed = true
      }

      commit('MutUiAbility', uiAbility.data)

      if (changed) {
        commit('windows/MutToggleDarkMode', true, { root: true })
      }
    } catch (e) {
      console.log(e)
    }
  },

  /** ************** START : social auth ****************/

  async ActAuthGoogle({ commit, rootState }) {
    // console.log('in action ActAuthGoogle', rootState);

    try {
      const url = '/auth/google'
      // console.log(url);

      await this.$axios.get(url
        , JSON.stringify({
          headers: {
            crossDomain: true,
            withCredentials: true,
            credentials: 'same-origin'
          }
        })
      )
    } catch (e) {
      console.log(e)
    }
  }

  /** ************** END : social auth ****************/

}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
