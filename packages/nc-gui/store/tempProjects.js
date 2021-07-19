export const state = () => ({
  list: [
    {
      id: 1,
      name: 'Applications :',
      children: [
        { id: 2, name: 'Calendar : app' },
        { id: 3, name: 'Chrome : app' },
        { id: 4, name: 'Webstorm : app' }
      ]
    },
    {
      id: 5,
      name: 'Documents :',
      children: [
        {
          id: 6,
          name: 'vuetify :',
          children: [
            {
              id: 7,
              name: 'src :',
              children: [
                { id: 8, name: 'index : ts' },
                { id: 9, name: 'bootstrap : ts' }
              ]
            }
          ]
        },
        {
          id: 10,
          name: 'material2 :',
          children: [
            {
              id: 11,
              name: 'src :',
              children: [
                { id: 12, name: 'v-btn : ts' },
                { id: 13, name: 'v-card : ts' },
                { id: 14, name: 'v-window : ts' }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 15,
      name: 'Downloads :',
      children: [
        { id: 16, name: 'October : pdf' },
        { id: 17, name: 'November : pdf' },
        { id: 18, name: 'Tutorial : html' }
      ]
    },
    {
      id: 19,
      name: 'Videos :',
      children: [
        {
          id: 20,
          name: 'Tutorials :',
          children: [
            { id: 21, name: 'Basic layouts : mp4' },
            { id: 22, name: 'Advanced techniques : mp4' },
            { id: 23, name: 'All about app : dir' }
          ]
        },
        { id: 24, name: 'Intro : mov' },
        { id: 25, name: 'Conference introduction : avi' }
      ]
    }
  ]
})

export const mutations = {
  add(state, tempProject) {
    console.log('data from form', tempProject)
    state.list.push(tempProject)
  },
  update(state, { tempProject }) {},
  remove(state, { tempProject }) {
    state.list.splice(state.list.indexOf(tempProject), 1)
  },
  list(state, tempProjects) {
    state.list = tempProjects
  }
}

export const getters = {
  list(state) {
    return state.list
  }
}

export const actions = {
  createProject({ commit, state }, data) {
    // async ops
    commit('add', data)
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
