
export const state = () => ({})

export const mutations = {
  mutPluginDetails(state, { title, settings }) {
    state[title] = settings
  }
}

export const getters = {
  brandName(state) {
    if (state.Branding && state.Branding.title) {
      return state.Branding.title
    }
    return 'NocoDB'
  },
  brandLogo(state) {
    if (state.Branding && state.Branding.logo && state.Branding.logo.length) {
      const images = JSON.parse(state.Branding.logo)
      if (images && images.length) { return images[0].url }
    }
    return require('~/assets/img/icons/512x512-trans.png')
  }
}

export const actions = {
  async pluginPostInstall({ commit, state }, title) {
    try {
      this.plugin = await this.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginRead', {
        title
      }])
      const settings = JSON.parse(this.plugin.input) || {}
      commit('mutPluginDetails', {
        title,
        settings
      })
    } catch (e) {
      //  ignore
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
