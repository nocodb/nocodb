<template>
  <div>
    <h3 class="text-center mb-5 grey--text text--darken-2">
      Appearance
    </h3>

    <v-simple-table dense style="">
      <template #default>
        <tbody>
          <tr>
            <td>Dark Mode</td>
            <td>
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-icon
                    x-large
                    :color="$vuetify.theme.dark ? 'primary':'primary'"
                    @click="toggleDarkTheme($vuetify.theme.dark)"
                    v-on="on"
                  >
                    mdi-bat
                  </v-icon>
                </template>
                <h3 class="pa-3">
                  {{ $vuetify.theme.dark ? 'It does come in Black' : 'Does it come in Black ?' }}
                  <i />
                </h3>
              </v-tooltip>
            </td>
          </tr>
          <tr @dblclick="darkThemeAppBar = true">
            <td>Invert header font colors</td>
            <td>
              <v-switch
                v-model="darkThemeAppBar"
                flat
              />
            </td>
          </tr>
          <tr @dblclick="enableAppRefresh = true">
            <td>
              Auto update
            </td>
            <td>
              <v-switch
                v-model="autoUpdate"
                flat
              />
            </td>
          </tr>
          <tr>
            <td>Themes</td>
            <td class="pa-1">
              <v-list rounded>
                <v-list-item-group v-model="item" color="primary">
                  <v-list-item
                    v-for="(t,i) in themes"
                    :key="i"
                    class="mb-n1"
                    :value="i"
                    @click.native.prevent.stop="changeTheme(t,i)"
                  >
                    <v-list-item-content class="py-0">
                      <div class="d-flex align-center" style="width:100%">
                        <div style="width: 100px">
                          {{ i }}
                        </div>
                        <div class="flex-grow-1">
                          <v-container fluid class="pa-0">
                            <v-row>
                              <v-col
                                v-for="(col,key) in t"
                                :key="key"
                                class="mx-2"
                                style="height: 20px"
                                :style="{backgroundColor: col}"
                              />
                            </v-row>
                          </v-container>
                        </div>
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item
                    class="mb-n2"
                    value="Custom"
                    @click.native.prevent.stop="changeTheme(customTheme,'Custom')"
                  >
                    <v-list-item-content class="py-0">
                      <div class="d-flex align-center" style="width:100%">
                        <div style="min-width: 100px">
                          Custom
                        </div>
                        <div class="flex-grow-1">
                          <!--                            <v-container fluid>-->

                          <x-btn
                            v-for="(col,key) in customTheme"
                            :key="key"
                            small
                            btn.class="ma-1 caption"
                            :color="col"
                            tooltip="Click to change the color"
                            @click="customKey = key, colorPickerModel= true"
                          >
                            {{ key }}
                          </x-btn>
                        </div>
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                </v-list-item-group>
              </v-list>
            </td>
          </tr>

          <tr>
            <td>Show M2M Tables</td>
            <td>
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-checkbox
                    v-model="includeM2M"
                    v-t="[`c:themes:show-m2m-tables`]"
                    x-large
                    color="primary"
                    v-on="on"
                  >
                    mdi-table-network
                  </v-checkbox>
                </template>
                Include/Exclude M2M tables
              </v-tooltip>
            </td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>

    <v-dialog
      v-model="colorPickerModel"
      width="350"
    >
      <v-color-picker
        v-if="customTheme[customKey]"
        v-model="customTheme[customKey]"
        class="mx-auto my-2"
        @input="changeTheme(customTheme)"
      />
    </v-dialog>
  </div>
</template>
<script>

import themes from '../../../helpers/themes'

export default {
  components: { },

  data() {
    return {
      rightClickCount: 0,
      tab: null,
      languages: [
        { label: 'English', value: 'en' }
        // {label: 'Japanese', value: 'ja'},
        // {label: 'Chinese', value: 'zh'}
      ],
      item: 'default',
      primary: '',
      colors: [
        '#ea4235',
        '#4CAF50',
        '#FF9800',
        '#0288D1'
      ],
      customKey: null,
      colorPickerModel: false,
      customTheme: {
        primary: '#6f5dcc',
        secondary: '#BFDBF7',
        accent: '#ED254E',
        info: '#00CED1',
        success: '#4CAF50',
        warning: '#FB8C00',
        error: '#ff0100',
        headerBg: '#6f5dcc'
      },
      themes
    }
  },
  fetch({ store, params }) {
  },
  computed: {
    language: {
      get() {
        return this.$store.state.settings.language
      },
      set(val) {
        this.$store.commit('settings/MutLanguage', val)
      }
    },
    showMetatable: {
      get() {
        return this.$store.state.settings.metatables
      },
      set(show) {
        this.$store.commit('settings/MutMetatables', show)
      }
    },
    showScreensaver: {
      get() {
        return this.$store.state.settings.screensaver
      },
      set(show) {
        this.$store.commit('settings/MutScreensaver', show)
      }
    },
    includeM2M: {
      get() {
        return this.$store.state.settings.includeM2M
      },
      set(show) {
        this.$store.commit('settings/MutIncludeM2M', show)
      }
    },
    darkThemeAppBar: {
      get() {
        return this.$store.state.settings.darkThemeAppBar
      },
      set(show) {
        this.$store.commit('settings/MutToggleDarkModeAppBar', show)
      }
    }
  },
  created() {
    this.customTheme = { ...this.customTheme, ...this.$store.state.settings.customTheme }
    this.item = this.$store.state.settings.themeName
    this.$store.watch(
      state => state.settings.customTheme,
      (theme) => {
        this.customTheme = { ...this.customTheme, ...theme }
      })

    this.$store.watch(state => state.settings.themeName,
      (theme) => {
        this.$nextTick(() => {
          if (this.item !== theme) { this.item = theme }
        })
      })
  },
  methods: {
    rightClick() {
      this.rightClickCount++
      if (this.rightClickCount > 5) {
        // require('electron').remote.getCurrentWindow().toggleDevTools();
        this.rightClickCount = 0
      }
    },
    async changeTheme(t, theme = 'Custom') {
      this.item = theme
      if (theme === 'Custom') { await this.$store.dispatch('settings/ActSetTheme', { theme: { ...t }, custom: true }) }
      await this.$store.dispatch('settings/ActSetTheme', { theme: { ...t }, themeName: theme })
      this.$e('c:themes:change', { mode: theme })
    },
    toggleDarkTheme(mode) {
      this.$store.commit('settings/MutToggleDarkMode')
      this.$e('c:themes:dark-mode', { dark: mode })
    }
  },
  beforeCreated() {
  }
}
</script>

<style scoped>

</style>
<!--
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
-->
