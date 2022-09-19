export const state = () => ({

  /**
   *
   * type : GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH
   *
   * URL :
   *
   */
  list: [{
    url: `${process.env.NC_BACKEND_URL || 'http://localhost:8080'}/graphql`
  }]

})

export const mutations = {

  MutListAdd(state, args) {
    state.list.unshift(args)
    if (state.list.length > 500) { state.list.pop() }
  },

  MutListRemove(state, index) {
    state.list.splice(index, 1)
  }
}

export const actions = {

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
