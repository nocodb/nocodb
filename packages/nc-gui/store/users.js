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

  GtrIsAuthenticated(state, getters, rootState) {
    return rootState.project.projectInfo &&
      (rootState.project.projectInfo.authType === 'none' ||
        (rootState.project.projectInfo.authType === 'jwt' && state.user) ||
        (rootState.project.projectInfo.authType === 'masterKey' && state.masterKey)
      )
  },

  GtrIsAdmin(state) {
    // return (state.authType === 'jwt' && state.user && state.user.roles && (state.user.roles.creator || state.user.roles.owner)) || (state.authType === 'masterKey' && state.masterKey) || state.authType === 'none'
    return (state.user && state.user.roles && (state.user.roles.creator || state.user.roles.owner)) ||
      (state.projectRole && (state.projectRole.creator || state.projectRole.owner))
  },

  GtrIsUIAllowed(state) {
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

  // MutPlusCounter(state, todos) {
  //   //console.log('in MutPlusCounter');
  //   state.counter += 1
  // },

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
    // console.log('in MutPlusCounter', user);
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
    console.log('Within action : ActPollSession')
    setInterval(async() => {
      console.log('Poll section : ')
      if (getters.GtrUser) {
        try {
          const res = await this.$axios.get('/user/me')
          if (res.data === null || !res.data.email) {
            console.log('Setting user to null : no session available')
            commit('MutSetUser', null)
          } else {
            commit('MutSetUser', res.data)
          }
          commit('windows/MutPollingSet', 0, { root: true })
        } catch (e) {
          if (e.response.status === 504) {
            console.log('polling timed out: maxPollingRetryExceeded ', rootGetters['windows/GtrMaxPollingRetryExceeded'])
            commit('windows/MutPollingIncrementBy', 1, { root: true })

            if (rootGetters['windows/GtrMaxPollingRetryExceeded']) {
              console.log('polling retry has been exceeded resetting user to null and retry count to 0')
              commit('MutSetUser', null)
              commit('windows/MutPollingSet', 0, { root: true })
            }
          } else {
            console.log('Unknown error while polling', e)
            commit('MutSetUser', null)
            commit('windows/MutPollingSet', 0, { root: true })
          }
        }
      } else {
        console.log('User is null')
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
      const userPromise = await this.$axios.post('/auth/signup?tool=1', data)
      // console.log(userPromise);
      commit('MutSetToken', userPromise.data.token)
      // await dispatch('ActGetUserUiAbility')
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
      const userPromise = await this.$axios.post('/auth/signin?tool=1', data)
      // console.log(userPromise);
      commit('MutSetToken', userPromise.data.token)
      // await dispatch('ActGetUserUiAbility')
      await dispatch('ActGetUserDetails')

      //
      // let userPromise = await this.$axios.post('/auth/signin?tool=1', data);
      // //console.log('userPromise', userPromise);
      // commit('MutSetUser', userPromise.data);
      //
      // let paidUser = await this.$axios.get('/subscription/isActive');
      // console.log('paidUser', paidUser, paidUser.data.isActive);
      // commit('MutSetPaidUser', paidUser.data.isActive);
      //
      // await dispatch('ActGetUserUiAbility')
    } catch (e) {
      err = e.response
    }
    console.log('err', err)
    return err
  },

  async ActSignOut({ commit }) {
    // console.log('in action signout');

    let err = null

    try {
      // let err = await this.$axios.get('/auth/signout');
      // console.log(err);
      commit('MutSetUser', null)
      commit('MutSetToken', null)
      commit('MutMasterKey', null)
      commit('MutAuthType', null)
      // commit('MutSetProjectToNull', null)
      // commit('MutSetPaidUser', false);
      //
      // commit('MutUiAbility', {
      //   rules: {
      //     darkTheme: false,
      //     maxTables: 5,
      //   }
      // })
    } catch (e) {
      err = e
      console.log(e)
    }

    return err
  },
  /** ************** END : authentication ****************/

  /** ************** START : password reset-recovery ****************/
  async ActPasswordForgot({ commit }, data) {
    try {
      await this.$axios.post('/auth/password/forgot', data)
    } catch (e) {
      return e.response
    }
  },

  async ActGetPasswordReset({ commit }, query) {
    // console.log('in action ActGetPasswordReset', query);

    try {
      const result = await this.$axios.get('/auth/token/validate/' + query.token)
      console.log(result)
      return true
    } catch (e) {
      console.log(e)
      return false
    }
  },

  async ActPostPasswordReset({ commit }, data) {
    try {
      const resetPromise = await this.$axios.post('/auth/password/reset/' + data.token, data)
      commit('MutSetUser', resetPromise.data)
    } catch (e) {
      console.log(e)
    }
  },

  async ActPostPasswordChange({ commit }, data) {
    try {
      await this.$axios.post('/user/password/change', data)
    } catch (e) {
      return e.response
    }
  },

  async ActGetSubscriptionsList({ commit }, data) {
    try {
      const res = await this.$axios.get('/subscription/')
      console.log(res)
      return res.data
    } catch (e) {
      console.log(e)
      throw e
    }
  },
  /** ************** END : password reset-recovery ****************/

  async ActGetUserDetails({ commit, state }) {
    try {
      const user = await this.$axios.get('/user/me', {
        headers: {
          'xc-auth': state.token
        }
      })
      commit('MutSetUser', user && user.data)
    } catch (e) {
      console.log('ignoring user/me error')
    }
  },

  async ActGetProjectUserDetails({ commit, state }, projectId) {
    try {
      const user = await this.$axios.get('/user/me?project_id=' + projectId, {
        headers: {
          'xc-auth': state.token
        }
      })
      commit('MutProjectRole', user && user.data && user.data.roles)
    } catch (e) {
      console.log('ignoring user/me error')
    }
  },
  async ActGetBaseUserDetails({ commit, state }, sharedBaseId) {
    try {
      try {
        const user = await this.$axios.get('/user/me', {
          headers: {
            'xc-shared-base-id': sharedBaseId
          }
        })
        commit('MutProjectRole', user && user.data && user.data.roles)
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
  ActAuthFb({ commit }) {
    // console.log('in action signout');
  },

  ActAuthFbCbk({ commit }) {
    // console.log('in action signout');
  },

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

      // console.log('after actauthgoogle');

      // console.log(gProimise);
      // this.$router.push(rootState.route.from.path)
      // this.$router.push(url)
    } catch (e) {
      console.log(e)
    }
  },

  ActAuthGoogleCbk({ commit }) {
    // console.log('in action signout');
  },

  ActAuthPaypal({ commit }) {
    // console.log('in action signout');
  },

  ActAuthPaypalCbk({ commit }) {
    // console.log('in action signout');
  },

  ActAuthTwitter({ commit }) {
    // console.log('in action signout');
  },

  ActAuthTwitterCbk({ commit }) {
    // console.log('in action signout');
  },
  async ActGetAuthType({ commit }) {
    const { type, firstUser } = (await this.$axios.get('/auth/type')).data
    commit('MutAuthType', type)
    return { type, firstUser }
  },
  async ActVerifyMasterKey({ commit }, secret) {
    return (await this.$axios({
      url: '/auth/admin/verify',
      baseURL: `${this.$axios.defaults.baseURL}/dashboard`,
      method: 'post',
      data: { secret }
    })).data
    // return (await this.$axios.post(, {secret})).data;
  }

  // ActAuthLinkedin({commit}) {
  //   //console.log('in action signout');
  // },
  //
  // ActAuthLinkedinCbk({commit}) {
  //   console.log('in action signout');
  // },
  //
  // ActAuthLinkedin({commit}) {
  //   console.log('in action signout');
  // },
  //
  // ActAuthLinkedinCbk({commit}) {
  //   console.log('in action signout');
  // },
  /** ************** END : social auth ****************/

}

// export default {
//   state,
//   getters,
//   actions,
//   mutations
// }

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
