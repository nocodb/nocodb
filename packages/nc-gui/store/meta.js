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
  async ActLoadMeta({ state, commit, dispatch }, { tn, env, dbAlias, force }) {
    if (!force && state.loading[tn]) {
      return await new Promise((resolve) => {
        const unsubscribe = this.app.store.subscribe((s) => {
          if (s.type === 'meta/MutLoading' && s.payload.key === tn && !s.payload.value) {
            unsubscribe()
            resolve(state.metas[tn])
          }
        })
      })
    }
    if (!force && state.metas[tn]) {
      return state.metas[tn]
    }
    commit('MutLoading', {
      key: tn,
      value: true
    })
    const model = await dispatch('sqlMgr/ActSqlOp', [{ env, dbAlias }, 'tableXcModelGet', { tn }], { root: true })
    const meta = JSON.parse(model.meta)
    commit('MutMeta', {
      key: tn,
      value: meta
    })
    commit('MutLoading', {
      key: tn,
      value: undefined
    })
    return force ? model : meta
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
