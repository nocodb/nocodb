import axios from 'axios'

// resourceState
const state = () => ({

  // resourceList : []
  users: []

})

// modified state vars
const getters = {

  GtrUsers (state) {
    return state.users
  }

}

// state variables are modified here
const mutations = {

  MutSetUsers (state, users) {
    // console.log('in MutPlusCounter', users);
    state.users = users
  }

}

// mutation are performed via actions
const actions = {

  /** ************** START : users admin ****************/
  async ActGetUsers ({ commit }) {
    console.log('in action ActGetUsers')
    try {
      const usersPromise = await axios.get('/api/users')
      commit('MutSetUsers', usersPromise.data)
      console.log(usersPromise)
    } catch (e) {
      console.log(e)
    }
  },

  async ActGetUser ({ commit }, data) {
    try {
      const usersPromise = await axios.get('/api/users/' + data)
      console.log(usersPromise)
      // console.log(data);
      // return {}
      return usersPromise.data
    } catch (e) {
      console.log(e)
    }
  },

  ActUpdateUser ({ commit }) {
    console.log('in action signout')
  },

  ActDeleteUser ({ commit }) {
    console.log('in action signout')
  }
  /** ************** END : users admin ****************/

}

export default {
  state,
  getters,
  actions,
  mutations
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
