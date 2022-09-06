export const state = () => ({

  /**
   * status   - pending | error | success
   * type     - create | update | delete
   * module - table | view | procedure | function | index | trigger | rows
   * title    -
   */
  list: [],
  showProgressBar: []

})

export const mutations = {

  MutListAdd(state, args) {
    args.time = Date.now()
    state.list.unshift(args)
  },

  MutListRemove(state, args) {
    // find index and set status
    const index = state.list.findIndex(n => n.status === 'pending' &&
      n.type === args.type &&
      n.module === args.module &&
      n.title === args.title)
    if (index > -1) {
      state.list[index].status = args.status
    }
    state.list = [...state.list]
  },

  MutListClearFinished(state, args) {
    let len = state.list.length
    while (len--) {
      if (state.list[len].status !== 'pending') { state.list.splice(len, 1) }
    }
  },

  MutToggleProgressBar(state, status) {
    if (status) { state.showProgressBar.push(1) } else { state.showProgressBar.pop() }
  }

}

export const getters = {

  GetPendingStatus: ({ list, showProgressBar }) => showProgressBar.length || list.some(({ status }) => status === 'pending'),
  GetHasErrors: ({ list }) => list.some(({ status }) => status === 'error')

}

export const actions = {}
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
