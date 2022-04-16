import Vue from 'vue'

export const state = () => ({
  list: [],
  activeTab: 0,
  activeTabCtx: {},
  tabsState: {}
})

export const mutations = {
  add(state, tab) {
    if (state.list.length >= 8) {
      state.list.shift()
    }
    state.list = [...state.list, tab]
  },
  remove(state, index) {
    state.list.splice(index, 1)
  },
  removeTableOrViewTabs(state) {
    state.list = state.list.filter(t => !['table', 'view'].includes(t.type))
  },
  clear(state, index) {
    state.list = []
  },
  active(state, index) {
    if (state.list[index]) {
      state.activeTabCtx = { ...state.list[index] }
      state.activeTab = index
      this.$router.push({
        query: {
          name: state.list[index].name || '',
          dbalias: (state.list[index]._nodes && state.list[index]._nodes.dbAlias) || '',
          type: (state.list[index]._nodes && state.list[index]._nodes.type) || ''
        }
      })
    }
  },
  list(state, list) {
    Vue.set(state, 'list', list)
  },
  activeTabCtx(state, activeTabCtx) {
    let list = [...state.list]

    list = list.map((el) => {
      if (el.name === state.activeTabCtx.name) {
        return { ...el, name: activeTabCtx.name } // add props can be updated every rest keep it as it is
      }
      return el
    })

    state.activeTabCtx = activeTabCtx

    Vue.set(state, 'list', list)

    // state.list = list;
  },
  MutSetTabState(state, { id, key, val }) {
    const tabState = { ...(state.tabsState[id] || {}) }
    Vue.set(tabState, key, val)
    Vue.set(state.tabsState, id, tabState)
  },
  MutClearTabState(state, key) {
    if (key) {
      const newState = { ...state.tabsState }
      delete newState[key]
      state.tabsState = newState
    } else {
      state.tabsState = {}
    }
  }
}

export const getters = {
  list(state) {
    return state.list
  },
  activeTab(state) {
    return state.activeTab
  },
  activeTabCtx(state) {
    return state.activeTabCtx
  }
}

export const actions = {
  async changeActiveTab({ commit, state }, index) {
    commit('active', index)
  },
  async loadDefaultTabs({ commit, state, rootGetters, dispatch, rootState }, load) {
    const tabs = []

    if ('name' in this.$router.currentRoute.query &&
      'type' in this.$router.currentRoute.query &&
      'dbalias' in this.$router.currentRoute.query
    ) {
      if (!load) {
        return commit('list', tabs)
      }
      const {
        name,
        type,
        dbalias
      } = this.$router.currentRoute.query
      try {
        let tabNode

        await dispatch('project/_loadTables', {
          dbKey: '0.projectJson.envs._noco.db.0',
          key: '0.projectJson.envs._noco.db.0.tables',
          _nodes: {
            dbAlias: 'db',
            // dbKey: "0.projectJson.envs._noco.db.0",
            env: '_noco',
            // key: "0.projectJson.envs._noco.db.0.tables",
            type: 'tableDir'
          }
        }, { root: true })
        /*        await dispatch('project/_loadViews', {
          dbKey: '0.projectJson.envs._noco.db.0',
          key: '0.projectJson.envs._noco.db.0.views',
          _nodes: {
            dbAlias: 'db',
            // dbKey: "0.projectJson.envs._noco.db.0",
            env: '_noco',
            // key: "0.projectJson.envs._noco.db.0.tables",
            type: 'viewDir'
          }
        }, { root: true }) */

        switch (type) {
          case 'table':
            /*            await dispatch('project/_loadTables', {
              dbKey: '0.projectJson.envs._noco.db.0',
              key: '0.projectJson.envs._noco.db.0.tables',
              _nodes: {
                dbAlias: dbalias,
                // dbKey: "0.projectJson.envs._noco.db.0",
                env: '_noco',
                // key: "0.projectJson.envs._noco.db.0.tables",
                type: 'tableDir'
              }
            }, { root: true }) */
            tabNode = rootState.project
              .list[0] // project
              .children[0] //  environment
              .children[0] // db
              .children.find(n => n.type === 'tableDir') // parent node
              .children.find(t => t.name === name)

            break
          case 'view':
            /*            await dispatch('project/_loadViews', {
              dbKey: '0.projectJson.envs._noco.db.0',
              key: '0.projectJson.envs._noco.db.0.views',
              _nodes: {
                dbAlias: dbalias,
                // dbKey: "0.projectJson.envs._noco.db.0",
                env: '_noco',
                // key: "0.projectJson.envs._noco.db.0.tables",
                type: 'viewDir'
              }
            }, { root: true }) */
            tabNode = rootState.project
              .list[0] // project
              .children[0] //  environment
              .children[0] // db
              // .children.find(n => n.type === 'viewDir') // parent node
              .children.find(n => n.type === 'tableDir') // parent node
              .children.find(t => t.name === name)

            break
          case 'function':
            await dispatch('project/_loadFunctions', {
              dbKey: '0.projectJson.envs._noco.db.0',
              key: '0.projectJson.envs._noco.db.0.functions',
              _nodes: {
                dbAlias: dbalias,
                // dbKey: "0.projectJson.envs._noco.db.0",
                env: '_noco',
                // key: "0.projectJson.envs._noco.db.0.tables",
                type: 'functionDir'
              }
            }, { root: true })
            tabNode = rootState.project
              .list[0] // project
              .children[0] //  environment
              .children[0] // db
              .children.find((n) => {
                return n.type === 'functionDir'
              }) // parent node
              .children.find((t) => {
                return t.name === name
              })

            break
          case 'procedure':
            await dispatch('project/_loadProcedures', {
              dbKey: '0.projectJson.envs._noco.db.0',
              key: '0.projectJson.envs._noco.db.0.procedures',
              _nodes: {
                dbAlias: dbalias,
                // dbKey: "0.projectJson.envs._noco.db.0",
                env: '_noco',
                // key: "0.projectJson.envs._noco.db.0.tables",
                type: 'procedureDir'
              }
            }, { root: true })
            tabNode = rootState.project
              .list[0] // project
              .children[0] //  environment
              .children[0] // db
              .children.find(n => n.type === 'procedureDir') // parent node
              .children.find(t => t.name === name)
            break
          case 'sequence':
            await dispatch('project/_loadFunctions', {
              dbKey: '0.projectJson.envs._noco.db.0',
              key: '0.projectJson.envs._noco.db.0.sequences',
              _nodes: {
                dbAlias: dbalias,
                // dbKey: "0.projectJson.envs._noco.db.0",
                env: '_noco',
                // key: "0.projectJson.envs._noco.db.0.tables",
                type: 'sequenceDir'
              }
            }, { root: true })
            tabNode = rootState.project
              .list[0] // project
              .children[0] //  environment
              .children[0] // db
              .children.find((n) => {
                return n.type === 'sequenceDir'
              }) // parent node
              .children.find((t) => {
                return t.name === name
              })

            break
        }
        if (tabNode) {
          tabs.push(tabNode)
        }
      } catch (e) {
        console.log(e)
      }
    } else {
      if (rootGetters['project/GtrProjectIsGrpc']) {
        const item = {
          name: 'gRPC Client',
          key: 'grpcClient',
          _nodes: {
            env: '_noco',
            type: 'grpcClient'
          }
        }
        tabs.push(item)
      } else if (rootGetters['project/GtrProjectIsGraphql']) {
        const item = {
          name: 'Graphql Client',
          key: 'graphqlClientDir',
          _nodes: {
            env: '_noco',
            type: 'graphqlClientDir'
          }
        }
        tabs.push(item)
      }

      if (rootGetters['users/GtrIsAdmin']) {
        tabs.unshift({
          name: 'Team & Auth ',
          key: 'roles',
          _nodes: {
            env: '_noco',
            type: 'roles'
          }
        })
      } else {
        const nodes = rootState.project
          .list[0] // project
          .children[0] //  environment
          .children[0] // db
          .children.find(n => n.type === 'tableDir') // parent node
          .children
        if (nodes && nodes[0]) {
          tabs.push(nodes[0])
        }
      }
    }
    commit('list', tabs)
  },

  removeTableTab({ commit, state }, nodes) {
    const tabs = JSON.parse(JSON.stringify(state.list))
    const tabIndex = state.list.findIndex(
      el =>
        el._nodes.env === nodes.env &&
        el._nodes.dbAlias === nodes.dbAlias &&
        el._nodes.table_name === nodes.table_name
    )
    tabs.splice(tabIndex, 1)
    commit('list', tabs)
  },
  removeViewTab({ commit, state }, nodes) {
    const tabs = JSON.parse(JSON.stringify(state.list))
    const tabIndex = state.list.findIndex(
      el =>
        el._nodes.env === nodes.env &&
        el._nodes.dbAlias === nodes.dbAlias &&
        el._nodes.view_name === nodes.view_name
    )
    tabs.splice(tabIndex, 1)
    commit('list', tabs)
  },
  removeFunctionTab({ commit, state }, nodes) {
    const tabs = JSON.parse(JSON.stringify(state.list))
    const tabIndex = state.list.findIndex(
      el =>
        el._nodes.env === nodes.env &&
        el._nodes.dbAlias === nodes.dbAlias &&
        el._nodes.function_name === nodes.function_name
    )
    tabs.splice(tabIndex, 1)
    commit('list', tabs)
  },
  removeProcedureTab({ commit, state }, nodes) {
    const tabs = JSON.parse(JSON.stringify(state.list))
    const tabIndex = state.list.findIndex(
      el =>
        el._nodes.env === nodes.env &&
        el._nodes.dbAlias === nodes.dbAlias &&
        el._nodes.procedure_name === nodes.procedure_name
    )
    tabs.splice(tabIndex, 1)
    commit('list', tabs)
  },
  removeSequenceTab({ commit, state }, nodes) {
    const tabs = JSON.parse(JSON.stringify(state.list))
    const tabIndex = state.list.findIndex(
      el =>
        el._nodes.env === nodes.env &&
        el._nodes.dbAlias === nodes.dbAlias &&
        el._nodes.sequence_name === nodes.sequence_name
    )
    tabs.splice(tabIndex, 1)
    commit('list', tabs)
  },
  removeTabsByName({ commit, state }, item) {
    let tabs = JSON.parse(JSON.stringify(state.list))
    tabs = tabs.filter((el) => {
      if (
        el._nodes.env === item._nodes.env &&
        el._nodes.dbAlias === item._nodes.dbAlias &&
        el.name === item.name
      ) {
        return false
      }

      return true
    })
    commit('list', tabs)
  },

  async ActAddTab({ commit, state, rootState }, item) {
    if (rootState.users.ui_ability.rules.maxTabs <= state.list.length) {
      this.commit('snackbar/setSnack', `Free plan limits to ${rootState.users.ui_ability.rules.maxTabs} tabs. Please <a href="https://nocodb.com/pricing" style="color: white;font-weight: bold;">upgrade</a> your plan for unlimited tabs.`)
      return
    }
    commit('add', item)
    await Vue.nextTick()
    const index = state.list.length - 1
    if (state.activeTab !== 0 && state.activeTab === index) {
      commit('active', index - 1)
      setTimeout(() => commit('active', index))
    } else {
      commit('active', index)
    }
    // this.$nextTick(() => {
    //   this.$router.push({
    //     query: {
    //       name: item.name || '',
    //       dbalias: (item._nodes || item._nodes.dbAlias) || '',
    //       type: (item._nodes || item._nodes.type) || ''
    //     }
    //   })
    // });
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
