export const state = () => ({

  servers: {}

})

export const mutations = {

  MutAddServer(state, args) {
    args.alive = true
    state.servers[args.key] = args
    state.servers = { ...state.servers }
    // state.servers[args.key].alive = true;
  },

  MutRemoveServer(state, args) {
    if (args.key in state.servers) {
      const temp = state.servers
      delete temp[args.key]
      state.servers = { ...temp }
    }
  },

  MutCloudUrl(state, args) {
    if (args.key in state.servers) {
      const temp = state.servers
      state.servers[args.key].cloudUrl = args.cloudUrl
      state.servers = { ...temp }
    }
  }

}

export const getters = {}

export const actions = {

  async start({ commit, state, rootState }, args) {
    commit('notification/MutToggleProgressBar', true, { root: true })

    try {
      // let result = await rootState.sqlMgr.sqlMgr.projectAPIServerStart(args);
      const result = await this.dispatch('sqlMgr/ActSqlOp', [null, 'projectAPIServerStart', args])

      if (result.code === 0) {
        const serverResult = { ...args, ...result.data.object }
        commit('MutAddServer', serverResult)
      }
    } catch (e) {
      console.log(e)
      throw e
    } finally {
      commit('notification/MutToggleProgressBar', false, { root: true })
    }
  },

  async stop({ commit, state, rootState }, args) {
    commit('notification/MutToggleProgressBar', true, { root: true })

    try {
      // let result = await rootState.sqlMgr.sqlMgr.projectAPIServerStop(args);
      const result = await this.dispatch('sqlMgr/ActSqlOp', [null, 'projectAPIServerStop', args])

      if (result.code === 0) {
        commit('MutRemoveServer', args)
      }
    } catch (e) {
      console.log(e)
      throw e
    } finally {
      commit('notification/MutToggleProgressBar', false, { root: true })
    }
  },

  async getCloudUrl({ commit, state, rootState }, args) {
    commit('notification/MutToggleProgressBar', true, { root: true })

    try {
      const result = await rootState.sqlMgr.sqlMgr.projectAPIServerGetCloudUrl(args)

      if (result.code === 0) {
        commit('MutCloudUrl', { ...args, ...result.data })
      }
    } catch (e) {
      console.log(e)
      throw e
    } finally {
      commit('notification/MutToggleProgressBar', false, { root: true })
    }
  },

  async cloudSendNotification({ commit, state, rootState }, args) {
    commit('notification/MutToggleProgressBar', true, { root: true })

    try {
      await rootState.sqlMgr.sqlMgr.projectAPIServerSendNotification(args)
    } catch (e) {
      console.log(e)
      throw e
    } finally {
      commit('notification/MutToggleProgressBar', false, { root: true })
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
