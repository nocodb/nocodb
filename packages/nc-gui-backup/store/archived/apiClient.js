import axios from 'axios'
import Vue from 'vue'

// const {autocannon} = require("electron").remote.require(
//   "./libs"
// );

export const state = () => ({

  /**
   *
   * type : GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH
   *
   * URL :
   *
   * headers :
   * body :
   * auth :
   *
   * response :
   *
   */
  list: [{
    type: 'GET',
    url: 'localhost:8080',
    body: '{}',
    headers: [],
    response: { status: 200 },
    createAt: Date.now()
  }],
  projectApiFilePaths: {},
  activeEnvironment: {},
  currentProjectKey: ''

})

export const mutations = {

  MutApiFilePathsAdd(state, args) {
    state.projectApiFilePaths = {
      ...state.projectApiFilePaths,
      [state.currentProjectKey]: [...state.projectApiFilePaths[state.currentProjectKey], args]
    }
  },

  MutApiFilePathsRemove(state, index) {
    state.projectApiFilePaths[state.currentProjectKey].splice(index, 1)
    Vue.set(state.projectApiFilePaths, state.currentProjectKey, [...state.projectApiFilePaths[state.currentProjectKey]])
  },

  MutListAdd(state, args) {
    state.list.unshift(args)
    if (state.list.length > 500) {
      state.list.pop()
    }
  },

  MutListRemove(state, index) {
    // find index and set status
    state.list.splice(index, 1)
    // state.list = [...state.list]
  },
  MutList(state, list) {
    state.projectApiFilePaths[state.currentProjectKey] = list
  },
  MutCurrentProjectKey(state, currentProjectKey) {
    state.currentProjectKey = currentProjectKey
  },
  MutActiveEnvironment(state, { projectId, env }) {
    state.activeEnvironment[projectId] = env
  }

}

export const getters = {
  GtrCurrentApiFilePaths(state) {
    return state.projectApiFilePaths[state.currentProjectKey]
  }
}

export const actions = {

  async send({ commit, state }, { apiDecoded, api }) {
    const a = { ...apiDecoded }
    let t, t1, t2
    try {
      commit('notification/MutToggleProgressBar', true, { root: true })

      if (apiDecoded.body) {
        try {
          a.body = JSON.parse(a.body)
        } catch (e) {
          console.log(e)
        }
      }

      if (apiDecoded.auth) {
        try {
          a.auth = JSON.parse(a.auth)
        } catch (e) {
          console.log(e)
        }
      }

      a.response = {}
      // t = process.hrtime();
      const req = {
        params: a.params
          ? a.params.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = param.value
            }
            return paramsObj
          }, {})
          : {},
        url: a.url,
        method: a.type,
        data: a.body,
        headers: a.headers
          ? a.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = header.value
            }
            return headersObj
          }, {})
          : {},
        withCredentials: true
      }

      if (Object.values(api.perf).every(v => !v)) {
        const data = await axios(req)

        // t1 = process.hrtime(t);
        // t2 = (t1[0] + t1[1] / 1000000000).toFixed(2);

        a.response.status = data.status
        a.response.headers = data.headers
        a.response.data = data.data
      } else {
        this.$toast.info('Starting performance test').goAway(3000)
        try {
          // const res = await autocannon({
          //   ...req,
          //   ...api.perf,
          //   body: req.data
          // });
          // console.log('perf result', res)

          a.response.status = 200
          a.response.headers = []
          a.response.data = {} // res

          this.$toast.info('Finished performance test').goAway(3000)
        } catch (e) {
          console.log(e)
          a.response.status = 400
          a.response.data = e
        }
      }
    } catch (e) {
      t1 = process.hrtime(t)
      t2 = (t1[0] + t1[1] / 1000000000).toFixed(2)

      a.response = e.response
      // throw e;
    } finally {
      commit('notification/MutToggleProgressBar', false, { root: true })
      commit('MutListAdd', {
        ...api,
        params: api.params && api.params.map(param => ({ ...param })),
        headers: api.headers && api.headers.map(header => ({ ...header })),
        body: JSON.stringify(api.body),
        auth: JSON.stringify(api.auth),
        timeTaken: t2,
        createdAt: Date.now()
      })
    }
    return a.response
  },

  async loadApiCollectionForProject({ commit, state }, { projectName, projectId }) {
    const key = projectName + '__' + projectId
    commit('MutCurrentProjectKey', key)
    if (!(key in state.projectApiFilePaths)) {
      commit('MutList', [])
    }
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
