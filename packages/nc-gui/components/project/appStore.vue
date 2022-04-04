<template>
  <div>
    <h3 class="mb-5 title grey--text">
      Configure apps
    </h3>
    <v-divider />
    <div class="d-flex h-100 nc-app-store-tab mt-5">
      <v-dialog v-model="pluginInstallOverlay" min-width="400px" max-width="700px" min-height="300">
        <v-card
          v-if="installPlugin && pluginInstallOverlay"
          :dark="$store.state.windows.darkTheme"
          :light="!$store.state.windows.darkTheme"
        >
          <app-install :id="installPlugin.id" :default-config="defaultConfig" @close="pluginInstallOverlay = false" @saved="saved()" />
        </v-card>
      </v-dialog>

      <dlg-ok-new
        v-model="pluginUninstallModal"
        :heading="`Please click on submit to reset ${resetPluginRef && resetPluginRef.title}`"
        ok-label="Submit"
        type="primary"
        @ok="confirmResetPlugin"
      />

      <v-dialog min-width="400px" max-width="700px" min-height="300">
        <v-card
          v-if="resetPluginRef"
          :dark="$store.state.windows.darkTheme"
          :light="!$store.state.windows.darkTheme"
        >
          <v-card-text> Please confirm to reset {{ resetPluginRef.title }}</v-card-text>
          <v-card-actions>
            <v-btn color="primary" @click="confirmResetPlugin">
              Yes
            </v-btn>
            <v-btn @click="pluginUninstallModal = false">
              No
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-container class="h-100 app-container">
        <v-row class="d-flex align-stretch">
          <v-col v-for="(app,i) in filteredApps" :key="i" class="" cols="6">
            <!--          @click="installApp(app)"-->

            <v-card
              height="100%"
              class="elevatio app-item-card "
            >
              <div class="install-btn ">
                <v-btn
                  v-if="app.parsedInput"
                  x-small
                  outlined
                  class=" caption text-capitalize"
                  @click="installApp(app)"
                >
                  <v-icon x-small class="mr-1">
                    mdi-pencil
                  </v-icon>
                  {{ $t('general.edit') }}
                </v-btn>
                <v-btn
                  v-if="app.parsedInput"
                  x-small
                  outlined
                  class="caption text-capitalize"
                  @click="resetApp(app)"
                >
                  <v-icon x-small class="mr-1">
                    mdi-close-circle-outline
                  </v-icon>
                  Reset
                </v-btn>
                <v-btn v-else x-small outlined class=" caption text-capitalize" @click="installApp(app)">
                  <v-icon x-small class="mr-1">
                    mdi-plus
                  </v-icon>
                  Install
                </v-btn>
              </div>

              <div class="d-flex flex-no-wrap">
                <v-avatar
                  class="ma-3 align-self-center"
                  size="50"
                  tile
                  :color="app.title === 'SES' ? '#242f3e' : ''"
                >
                  <v-img v-if="app.logo" :src="app.logo" contain />
                  <v-icon v-else-if="app.icon" color="#242f3e" size="50">
                    {{ app.icon }}
                  </v-icon>
                </v-avatar>
                <div class="flex-grow-1">
                  <v-card-title
                    class="title "
                    v-text="app.title"
                  />

                  <v-card-subtitle class="pb-1" v-text="app.description" />
                  <v-card-actions>
                    <div class="d-flex justify-space-between d-100 align-center">
                    <!--                    <v-rating-->
                    <!--                      full-icon="mdi-star"-->
                    <!--                      readonly-->
                    <!--                      length="5"-->
                    <!--                      size="15"-->
                    <!--                      :value="5"-->
                    <!--                    />-->

                    <!--                    <span class="subtitles" v-if="app.price && app.price !== 'Free'">${{ app.price }} / mo</span>-->
                    <!--                    <span class="subtitles" v-else>Free</span>-->
                    </div>
                  </v-card-actions>

                <!--                <v-card-actions>-->
                <!--                  <v-btn-->
                <!--                    outlined-->
                <!--                    rounded-->
                <!--                    small-->
                <!--                  >-->
                <!--                    Download-->
                <!--                  </v-btn>-->
                <!--                </v-card-actions>-->
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!--      <v-navigation-drawer width="300" class="pa-1">
        <v-text-field
          v-model="query"
          dense
          hide-details
          :placeholder="$t('placeholder.searchApps')"
          color="primary"
          class="search-field caption"
        >
          <template #prepend-inner>
            <v-icon small class="mt-1">
              mdi-magnify
            </v-icon>
          </template>
        </v-text-field>

        <v-list dense>
          <v-list-item v-for="filter of filters" :key="filter" dense>
            <v-checkbox
              v-model="selectedTags"
              class="pt-0 mt-0"
              :value="filter"
              hide-details
              dense
              :label="filter"
            >
              <template #label>
                <v-icon small class="mr-1">
                  {{ icons[filter] }}
                </v-icon>

                {{ filter }}
              </template>
            </v-checkbox>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>-->
    </div>
  </div>
</template>

<script>
import AppInstall from '@/components/project/appStore/appInstall'
import DlgOkNew from '@/components/utils/dlgOkNew'

export default {
  name: 'AppStore',
  components: { DlgOkNew, AppInstall },
  data: () => ({
    query: '',
    selectedTags: [],
    apps: [],
    pluginInstallOverlay: false,
    installPlugin: null,
    resetPluginRef: null,
    pluginUninstallModal: false,
    defaultConfig: {},
    icons: {
      Email: 'mdi-email-outline',
      Storage: 'mdi-usb-flash-drive-outline',
      Notification: 'mdi-bell-outline',
      Authentication: 'mdi-shield-account-outline',
      Brand: 'mdi-sparkles',
      Cache: 'mdi-cached',
      Enterprise: 'mdi-bank',
      Chat: 'mdi-chat-outline'
    }
  }),
  computed: {
    filters() {
      return this.apps.reduce((arr, app) => arr.concat(app.tags || []), []).filter((f, i, arr) => i === arr.indexOf(f)).sort()
    },
    filteredApps() {
      return this.apps.filter(app => (!this.query.trim() || app.title.toLowerCase().includes(this.query.trim().toLowerCase())) &&
        (!this.selectedTags.length || this.selectedTags.some(t => app.tags && app.tags.includes(t)))
      )
    }
  },
  async created() {
    await this.loadPluginList()
    this.readPluginDefaults()
  },
  methods: {
    async readPluginDefaults() {
      try {
        this.defaultConfig = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginDemoDefaults'])
      } catch (e) {
      }
    },
    async confirmResetPlugin() {
      try {
        await this.$api.plugin.update(this.resetPluginRef.id, {
          input: null,
          active: 0
        })
        this.$toast.success('Plugin uninstalled successfully').goAway(5000)
        await this.loadPluginList()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit(`appstore:reset:${this.resetPluginRef.title}`)
    },
    async saved() {
      this.pluginInstallOverlay = false
      await this.loadPluginList()
      this.$tele.emit(`appstore:install:submit:${this.installPlugin.title}`)
    },
    async installApp(app) {
      this.pluginInstallOverlay = true
      this.installPlugin = app

      this.$tele.emit(`appstore:install:trigger:${app.title}`)
    },
    async resetApp(app) {
      this.pluginUninstallModal = true
      this.resetPluginRef = app
    },
    async loadPluginList() {
      try {
        // const plugins = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginList'])
        const plugins = (await this.$api.plugin.list()).list
        // plugins.push(...plugins.splice(0, 3))
        this.apps = plugins.map((p) => {
          p.tags = p.tags ? p.tags.split(',') : []
          p.parsedInput = p.input && JSON.parse(p.input)
          return p
        })
      } catch (e) {

      }
    }
  }
}
</script>

<style scoped lang="scss">

.app-item-card {
  transition: .4s background-color;
  position: relative;
  overflow-x: hidden;

  .install-btn {
    position: absolute;
    opacity: 0;
    right: -100%;
    top: 10px;
    transition: .4s opacity, .4s right;
  }

  &:hover .install-btn {
    right: 10px;
    opacity: 1;
  }
}

.app-item-card {
  transition: .4s background-color, .4s transform;

  &:hover {
    background: rgba(123, 126, 136, 0.1) !important;
    transform: scale(1.01);
  }
}

::v-deep {
  .v-rating {
    margin-left: 6px;

    .v-icon {
      padding-right: 2px;
      padding-left: 2px;
    }
  }

  .v-input__control .v-input__slot .v-input--selection-controls__input {
    transform: scale(.75);
  }

  .v-input--selection-controls .v-input__slot > .v-label {
    font-size: .8rem;
  }

  .search-field.v-text-field > .v-input__control, .search-field.v-text-field > .v-input__control > .v-input__slot {
    min-height: auto;
  }
}

.app-container {
  height: 100%;
  overflow-y: auto;
}

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
