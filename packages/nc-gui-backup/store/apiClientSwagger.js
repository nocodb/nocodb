import Vue from 'vue'

export const state = () => ({
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
    state.projectApiFilePaths[state.currentProjectKey] = [...state.projectApiFilePaths[state.currentProjectKey]]
  },

  MutListAdd(state, args) {
    state.list.unshift(args)
    if (state.list.length > 500) { state.list.pop() }
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
  MutActiveEnvironment(state, { env }) {
    Vue.set(state.activeEnvironment, state.currentProjectKey, env)
  }

}

export const getters = {
  GtrCurrentApiFilePaths(state) {
    return state.projectApiFilePaths[state.currentProjectKey]
  }
}

export const actions = {

  async send({ commit, state, rootGetters }, { apiDecoded, api }) {
    const apiMeta = { ...apiDecoded }
    // let t, t1, t2

    // return (await rootGetters['sqlMgr/sqlMgr'].sqlOp(null, 'handleApiCall', apiMeta));

    return (await this.dispatch('sqlMgr/ActSqlOp', [null, 'handleApiCall', apiMeta]))
    //
    // try {
    //   commit('notification/MutToggleProgressBar', true, {root: true});
    //   const req = XcApiHelp.axiosRequestMake(apiMeta);
    //   console.log(req);
    //
    //
    //   if (Object.values(apiMeta.perf).every(v => !v)) {
    //
    //     // t = process.hrtime();
    //     let data = await axios(req);
    //
    //     // t1 = process.hrtime(t);
    //     // t2 = (t1[0] + t1[1] / 1000000000).toFixed(2);
    //
    //     apiMeta.response.status = data.status;
    //     apiMeta.response.headers = data.headers;
    //     apiMeta.response.data = data.data;
    //     console.log(data);
    //   } else {
    //     this.$toast.info('Starting performance test').goAway(3000);
    //     try {
    //       const res = await autocannon({
    //         ...req,`
    //         ...apiMeta.perf,
    //         body: req.data
    //       });
    //       console.log('perf result', res)
    //
    //       apiMeta.response.status = 200;
    //       apiMeta.response.headers = [];
    //       apiMeta.response.data = res;
    //
    //       this.$toast.info('Finished performance test').goAway(3000);
    //
    //     } catch (e) {
    //       console.log(e)
    //       apiMeta.response.status = 400;
    //       apiMeta.response.data = e;
    //     }
    //
    //   }
    // } catch (e) {
    //   // t1 = process.hrtime(t);
    //   // t2 = (t1[0] + t1[1] / 1000000000).toFixed(2);
    //
    //   console.log(e, Object.keys(e), Object.entries(e));
    //   apiMeta.response = e.response;
    //   if (apiMeta.response)
    //     delete apiMeta.response.request
    //   //throw e;
    // } finally {
    //   commit('notification/MutToggleProgressBar', false, {root: true});
    // }
    // return {
    //   ...apiMeta,
    //   body: JSON.stringify(apiMeta.body, 0, 2),
    //   response: {
    //     ...apiMeta.response,
    //     timeTaken: t2,
    //     createdAt: Date.now()
    //   }
    // };
  },

  async loadApiCollectionForProject({ commit, state }, { projectName = '__default', projectId = '__id' }) {
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
