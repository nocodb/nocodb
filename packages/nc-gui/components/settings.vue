<template>
  <v-dialog
    v-model="dialogShow"
    width="60%"
  >
    <v-container>
      <v-card class="pa-10">
        <v-icon class="float-right  " color="error" @click="dialogShow = false">
          mdi-close-box-outline
        </v-icon>
        <p class="text-center" /><p class="display-1 text-center">
          NocoDB: Settings
        </p>

        <v-tabs
          v-model="tab"
          color="pink"
        >
          <v-tabs-slider />

          <v-tab
            href="#tab-theme"
          >
            Appearance
          </v-tab>

          <v-tab-item
            value="tab-theme"
          >
            <v-card
              flat
              tile
            >
              <v-simple-table dense style="border: 1px solid grey">
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
                              @click="toggleDarkTheme"
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
                    <tr>
                      <td>Language</td>
                      <td>
                        <v-radio-group v-model="language" row>
                          <v-radio
                            v-for="{label,value} in languages"
                            :key="value"
                            :label="label"
                            :value="value"
                          />
                        </v-radio-group>
                      </td>
                    </tr>
                    <tr>
                      <td>Themes</td>
                      <td class="pa-1">
                        <v-list rounded>
                          <!--              <v-subheader>REPORTS</v-subheader>-->
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
                  </tbody>
                </template>
              </v-simple-table>
            </v-card>
          </v-tab-item>

          <v-tab
            href="#tab-other"
          >
            Version & Updates
          </v-tab>

          <v-tab-item
            value="tab-other"
          >
            <v-card
              flat
              tile
            >
              <v-simple-table dense style="border: 1px solid grey">
                <template #default>
                  <tbody>
                    <tr>
                      <td>
                        Version
                      </td>
                      <td>
                        <span @contextmenu="rightClick">{{ $store.state.windows.version }}</span>
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
                          color="grey "
                        />
                      </td>
                    </tr>
                    <tr v-if="enableAppRefresh">
                      <td>
                        Application refresh
                      </td>
                      <td>
                        <v-btn @click="applicationRefresh">
                          Refresh
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </template>
              </v-simple-table>
            </v-card>
          </v-tab-item>
        </v-tabs>
      </v-card>
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

      <dlgLabelSubmitCancel
        v-if="dialogShow"
        :dialog-show="gaDialogShow"
        :actions-mtd="gaDialogFunction"
        heading="Click submit to disable Google Analytics."
        type="primary"
      />

      <dlgLabelSubmitCancel
        v-if="dialogShow"
        :dialog-show="logReportDialogShow"
        :actions-mtd="logReportDialogFunction"
        heading="Error reporting helps us to build a better product. Press cancel to help us build a better product ?"
        type="primary"
      />
    </v-container>
  </v-dialog>
</template>
<script>

import themes from '../helpers/themes'
import dlgLabelSubmitCancel from './utils/dlgLabelSubmitCancel'

export default {
  components: { dlgLabelSubmitCancel },
  directives: {},
  validate({ params }) {
    return true
  },
  props: { value: Boolean },

  data() {
    return {
      rightClickCount: 0,
      enableAppRefresh: false,
      tab: null,
      gaDialogShow: false,
      logReportDialogShow: false,
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
        error: '#ff0100'
      },
      themes
    }
  },
  fetch({ store, params }) {
  },
  computed: {
    checkForUpdate: {
      get() {
        return this.$store.state.windows.checkForUpdate
      },
      set(value) {
        this.$store.commit('windows/MutCheckForUpdate', value)
      }
    },
    autoUpdate: {
      get() {
        return this.$store.state.windows.downloadAndUpdateRelease
      },
      set(value) {
        this.$store.commit('windows/MutDownloadAndUpdateRelease', value)
      }
    },
    isGaEnabled: {
      get() {
        return this.$store.state.windows.isGaEnabled
      },
      set(value) {
        this.$store.commit('windows/MutToggleGaEnabled', value)
      }
    },
    isErrorReportingEnabled: {
      get() {
        return this.$store.state.windows.isErrorReportingEnabled
      },
      set(value) {
        this.$store.commit('windows/MutToggleErrorReportingEnabled', value)
      }
    },
    isTelemetryEnabled: {
      get() {
        return this.$store.state.windows.isErrorReportingEnabled
      },
      set(value) {
        this.$store.commit('windows/MutToggleTelemetryEnabled', value)
      }
    },
    dialogShow: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    language: {
      get() {
        return this.$store.state.windows.language
      },
      set(val) {
        this.$store.commit('windows/MutSetLanguage', val)
      }
    }
  },
  watch: {},
  created() {
    this.customTheme = { ...this.customTheme, ...this.$store.state.windows.customTheme }
    this.item = this.$store.state.windows.themeName
    this.$store.watch(
      state => state.windows.customTheme,
      (theme) => {
        this.customTheme = { ...this.customTheme, ...theme }
      })

    this.$store.watch(state => state.windows.themeName,
      (theme) => {
        this.$nextTick(() => {
          if (this.item !== theme) { this.item = theme }
        })
      })
  },
  beforeMount() {
  },
  async mounted() {

  },
  beforeDestroy() {
  },
  methods: {
    rightClick() {
      this.rightClickCount++
      if (this.rightClickCount > 5) {
        // require('electron').remote.getCurrentWindow().toggleDevTools();
        this.rightClickCount = 0
      }
    },
    async applicationRefresh() {
      localStorage.removeItem('vuex')
      location.reload()
    },
    toggleGa(event) {
      if (this.isGaEnabled) {
        this.gaDialogShow = true
      } else { this.isGaEnabled = true }
    },
    toggleLogReport(event) {
      if (this.isErrorReportingEnabled) {
        this.logReportDialogShow = true
      } else { this.isErrorReportingEnabled = true }
    },
    logReportDialogFunction(action) {
      if (action !== 'hideDialog' && this.$store.state.users.user && this.$store.state.users.user.email) {
        this.isErrorReportingEnabled = false
      } else {
        this.$toast.error('Only a registered user can disable Error Reporting, Please Login then disable.').goAway(5000)
      }
      this.logReportDialogShow = false
    },
    gaDialogFunction(action) {
      if (action !== 'hideDialog') {
        if (this.$store.state.users.user && this.$store.state.users.user.email) {
          this.isGaEnabled = false
        } else {
          this.$toast.error('Only a registered user can disable Google Analytics, Please Login then disable.').goAway(5000)
        }
      }
      this.gaDialogShow = false
    },
    async changeTheme(t, theme = 'Custom') {
      this.item = theme
      if (theme === 'Custom') { await this.$store.dispatch('windows/ActSetTheme', { theme: { ...t }, custom: true }) }
      await this.$store.dispatch('windows/ActSetTheme', { theme: { ...t }, themeName: theme })
    },
    toggleDarkTheme() {
      this.$store.commit('windows/MutToggleDarkMode')
    }
  },
  beforeCreated() {
  },
  destroy() {
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
