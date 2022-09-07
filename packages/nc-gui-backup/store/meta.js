export const state = () => ({
  metas: {},
  loading: {}
})

export const mutations = {
  MutMeta(state, { key, value }) {
    state.metas = { ...state.metas, [key]: value }
  },
  MutLoading(state, { key, value }) {
    state.loading = { ...state.loading, [key]: value }
  },
  MutClear(state) {
    state.metas = {}
  }
}

export const actions = {
  async ActLoadMeta({ state, commit, dispatch, rootState }, {
    table_name: tableName,
    env = '_noco',
    dbAlias = 'db',
    force,
    // eslint-disable-next-line camelcase
    project_id,
    id
  }) {
    if (!force && state.loading[tableName || id]) {
      return await new Promise((resolve) => {
        const unsubscribe = this.app.store.subscribe((s) => {
          if (s.type === 'meta/MutLoading' && s.payload.key === (id || tableName) && !s.payload.value) {
            unsubscribe()
            resolve(state.metas[tableName || id])
          }
        })
      })
    }
    if (!force && state.metas[tableName]) {
      return state.metas[tableName]
    }
    if (!force && state.metas[id]) {
      return state.metas[id]
    }

    const modelId = id ||
      (rootState
        .project
        .unserializedList[0]
        .projectJson
        .envs
        ._noco
        .db[0]
        .tables.find(t => t.title === tableName || t.table_name === tableName) || {}).id
    if (!modelId) {
      console.warn(`Table '${tableName}' is not found in the table list`)
      return
    }

    commit('MutLoading', {
      key: tableName || id,
      value: true
    })

    const model = await this.$api.dbTable.read(modelId)
    // const model = await dispatch('sqlMgr/ActSqlOp', [{ env, dbAlias, project_id }, 'tableXcModelGet', { tableName }], { root: true })
    // const meta = JSON.parse(model.meta)
    commit('MutMeta', {
      key: model.table_name,
      value: model
    })
    commit('MutMeta', {
      key: model.id,
      value: model
    })
    commit('MutLoading', {
      key: tableName || id,
      value: undefined
    })
    return force ? model : model
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
