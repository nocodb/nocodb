<template>
  <div style="height:100%">
    <v-tabs v-model="dbsTab" height="30" @change="loadCrons()">
      <template v-for="db in dbAliasList">
        <v-tab :key="db.meta.dbAlias" class="text-capitalize caption">
          {{ db.connection.database }}
          ({{ db.meta.dbAlias }})
        </v-tab>
        <v-tab-item :key="db.meta.dbAlias" style="height:100%">
          <!-- <v-toolbar flat height="42" class="toolbar-border-bottom">
             <v-toolbar-title>
               <v-breadcrumbs :items="[ ]" divider=">" dark large light class="title">
                 <template v-slot:divider>
                   <v-icon small color="grey lighten-2">forward</v-icon>
                 </template>
               </v-breadcrumbs>
             </v-toolbar-title>
             <v-spacer></v-spacer>
             <x-btn outlined tooltip="Reload list" small @click="loadCrons()" color="primary" icon="refresh">Reload
             </x-btn>
             <x-btn outlined tooltip="Add new cron job" small @click="addNewCron()" color="primary" icon="mdi-plus">New
               Cron
             </x-btn>
             <x-btn outlined :loading="updating" :disabled="updating || !selectedItem" tooltip="Save Changes" small
                    @click="saveCron()"
                    color="primary" icon="save">Save
             </x-btn>

           </v-toolbar>-->
          <v-card style="height:calc(100% - 42px)">
            <v-container style="height: 100%" fluid>
              <!--          <div class="d-flex d-100 justify-center">-->
              <v-row style="height:100%">
                <v-col cols="6">
                  <v-card class="pt-5 h-100">
                    <div style="position: relative; " class="mb-4">
                      <h4
                        class="text-center"
                        :class="{
                          'grey--text text--darken-2' : !$store.state.windows.darkTheme
                        }"
                      >
                        Cron Job List
                      </h4>

                      <div style="position: absolute; right:5px;bottom:0">
                        <x-btn
                          outlined
                          :tooltip="$t('tooltip.reloadList')"
                          small
                          color="primary"
                          icon="refresh"
                          @click="loadCrons()"
                        >
                          <!-- Reload -->
                          {{ $t('general.reload') }}
                        </x-btn>
                        <x-btn
                          outlined
                          tooltip="Add new cron job"
                          small
                          color="primary"
                          icon="mdi-plus"
                          @click="addNewCron()"
                        >
                          New
                          Cron
                        </x-btn>
                      </div>
                    </div>

                    <v-text-field
                      v-if="dbAliasList && dbAliasList[dbsTab]"
                      v-model="filter"
                      dense
                      hide-details
                      class="my-2 mx-auto"
                      :placeholder="`Filter '${dbAliasList[dbsTab].connection.database}' scheduled cron jobs`"
                      prepend-inner-icon="search"
                      style="max-width:500px"
                      outlined
                    />

                    <v-simple-table dense style="min-width: 400px">
                      <thead>
                        <tr>
                          <th class="text-center">
                            #
                          </th>
                          <th>Cron Title</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="crons && !crons.length">
                          <td class="caption text-center" colspan="3">
                            No cron jobs are found
                          </td>
                        </tr>
                        <template
                          v-for="(cron,i) in crons"
                        >
                          <tr
                            v-if="!filter || (cron.title && cron.title.toLowerCase().indexOf(filter.toLowerCase()) > -1)"
                            :key="`${cron.title}-${cron.id}`"
                            class="pointer"
                            @click="editCronHandler(cron)"
                          >
                            <td>
                              <v-radio-group v-model="selectedItemIndex" dense hide-details class="mt-n2">
                                <v-radio
                                  :value="i"
                                />
                              </v-radio-group>
                            </td>
                            <td>{{ cron.title }}</td>
                            <td>
                              <!--                          <v-icon small @click="editCronHandler(cron)">mdi-pencil</v-icon>-->
                              <x-icon
                                tooltip="Delete cron job"
                                class="ml-2"
                                color="error"
                                small
                                @click.stop="deleteCron(cron)"
                              >
                                mdi-delete
                              </x-icon>
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </v-simple-table>
                  </v-card>
                </v-col>
                <v-col v-if="selectedItem" cols="6" style="height:100%; overflow: auto">
                  <v-card class="px-4 py-2" style="min-height: 100%">
                    <v-row class="mt-3">
                      <v-col cols="12" class="edit-header">
                        <h4
                          class="text-center text-capitalize mt-2 d-100"
                          :class="{
                            'grey--text text--darken-2' : !$store.state.windows.darkTheme
                          }"
                        >
                          {{ selectedItem.title }}
                        </h4>
                        <div class="save-btn">
                          <x-btn
                            outlined
                            :loading="updating"
                            :disabled="updating || !selectedItem"
                            :tooltip="$t('tooltip.saveChanges')"
                            small
                            color="primary"
                            icon="save"
                            @click="saveCron()"
                          >
                            <!-- Save -->
                            {{ $t('general.save') }}
                          </x-btn>
                        </div>
                        <v-switch
                          v-model="selectedItem.active"
                          class="enable-disable-switch"
                          inset
                          dense
                          hide-details
                          :label="selectedItem.active ? 'Enabled' : 'Disabled' "
                        />
                      </v-col>
                      <!--                      <v-col cols="12">-->
                      <!--                        <v-switch-->
                      <!--                          inset-->
                      <!--                          dense-->
                      <!--                          hide-details-->
                      <!--                          v-model="selectedItem.active"-->
                      <!--                          :label="selectedItem.active ? 'Enabled' : 'Disabled' "-->
                      <!--                        ></v-switch>-->
                      <!--                      </v-col>-->
                      <v-col cols="12">
                        <v-text-field
                          v-model="selectedItem.title"
                          auto
                          dense
                          hide-details
                          outlined
                          label="Title"
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model="selectedItem.pattern"
                          dense
                          hide-details
                          outlined
                          label="Pattern"
                        />
                        <span class="caption grey--text">Generate pattern from <a
                          target="_blank"
                          href="http://corntab.com/"
                          class="grey--text"
                        >http://corntab.com/</a></span>
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model="selectedItem.timezone"
                          dense
                          hide-details
                          outlined
                          label="Timezone"
                        />
                        <span class="caption grey--text" target="_blank">All timezones available at <a
                          href="https://momentjs.com/timezone/"
                          class="grey--text"
                        >Moment Timezone Website</a>.</span>
                      </v-col>

                      <v-col cols="12">
                        <v-tabs height="30">
                          <v-tab><span class="caption text-capitalize">Handler</span></v-tab>
                          <v-tab-item class="pt-2">
                            <label class="caption grey--text">Cron handler</label>
                            <monaco-ts-editor
                              v-model="selectedItem.cron_handler"
                              style="height : 400px"
                            />
                          </v-tab-item>

                          <v-tab><span class="caption text-capitalize">Webhook</span></v-tab>

                          <v-tab-item class="pt-3">
                            <v-overlay absolute>
                              <div class="text-center">
                                Coming Soon...
                              </div>
                            </v-overlay>
                            <v-text-field
                              v-model="selectedItem.webhook"
                              dense
                              outlined
                              label="Webhook url"
                              type="url"
                            />
                          </v-tab-item>
                        </v-tabs>
                      </v-col>
                      <!--                      <v-col cols="12">-->
                      <!--                        <v-textarea-->
                      <!--                          dense-->
                      <!--                          hide-details-->
                      <!--                          v-model="selectedItem.description"-->
                      <!--                          dense outlined label="Description"></v-textarea>-->
                      <!--                      </v-col>-->
                      <!--
                       <v-col cols="6">
                         <v-text-field auto
                                       dense
                                       hide-details
                                       v-model="selectedItem.env"
                                       dense outlined label="Environment"></v-text-field>
                       </v-col>

                       <v-col cols="6">
                         <v-text-field auto
                                       dense
                                       hide-details
                                       v-model="selectedItem"
                                       dense outlined label="Timeout(in milliseconds)" type="number"
                                       step="1000"></v-text-field>
                       </v-col>
                       <v-col cols="6">
                         <v-text-field auto dense outlined label="Retry" type="number"
                                       step="1"></v-text-field>
                       </v-col>
                       <v-col cols="6">
                         <v-text-field auto dense outlined label="Retry interval(in milliseconds)" type="number"
                                       step="1000"></v-text-field>
                       </v-col>-->
                    </v-row>
                  </v-card>
                </v-col>
              </v-row>
            </v-container>
          </v-card>
          <!--          </div>-->
        </v-tab-item>
      </template>
    </v-tabs>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import MonacoTsEditor from '@/components/monaco/MonacoTsEditor'

export default {
  name: 'CronJobs',
  components: { MonacoTsEditor },
  props: ['nodes'],
  data: () => ({
    edited: false,
    crons: null,
    updating: false,
    dbsTab: 0,
    filter: '',
    selectedItem: null
  }),
  async mounted() {
    await this.loadCrons()
  },
  methods: {
    async editCronHandler(cron) {
      this.selectedItem = cron
    },
    async deleteCron(cron) {
      if (cron.id) {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.dbAliasList[this.dbsTab].meta.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'cronDelete', {
          id: cron.id
        }])
        await this.loadCrons()
      } else {
        this.crons.splice(this.crons.indexOf(cron), 1)
      }
      if (cron === this.selectedItem) {
        this.selectedItem = null
      }
    },
    async addNewCron() {
      this.crons = this.crons || []
      this.crons.push(this.selectedItem = {
        title: 'cron_job' + this.crons.length,
        pattern: '* * * * * *',
        timezone: 'America/Los_Angeles',
        active: true,
        cron_handler: ''
      })
    },
    async loadCrons() {
      this.crons = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        dbAlias: this.dbAliasList[this.dbsTab].meta.dbAlias,
        env: this.$store.getters['project/GtrEnv']
      }, 'xcCronList'])
      if (this.selectedItem) {
        this.selectedItem = this.crons.find(c => c.title === this.selectedItem.title)
      }
      this.edited = false
    },
    async saveCron() {
      this.updating = true
      const errorCrons = []
      try {
        const saveList = this.crons.filter((cron) => {
          if (cron === this.selectedItem || !cron.id) {
            if (cron.cron_handler.trim() && cron.webhook) {
              errorCrons.push(`'${cron.title}'`)
            }
            return true
          }
          return false
        })

        if (!errorCrons.length) {
          for (const cron of saveList) {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              dbAlias: this.dbAliasList[this.dbsTab].meta.dbAlias,
              env: this.$store.getters['project/GtrEnv']
            }, 'xcCronSave', cron])
          }

          await this.loadCrons()

          this.$toast.success('Cron job saved successfully').goAway(3000)
        } else {
          this.$toast.error(`${errorCrons.join(', ')} cron jobs<br> have both webhook and handler, please remove one of them.`).goAway(10000)
        }
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(3000)
        console.log(e, e.message)
      }
      this.updating = false
      this.edited = false
    }
  },
  computed: {
    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList'
    }),
    enableCountText() {
      return ''
    },
    selectedItemIndex: {
      get() {
        return this.crons ? this.crons.indexOf(this.selectedItem) : -1
      },
      set(i) {
        this.selectedItem = this.crons[i]
      }
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-tabs-bar {
    border-bottom: solid 1px var(--v-primary-lighten2);
  }

  .v-tab {
    border-right: 1px solid var(--v-primary-lighten2);
  }

  .v-input .v-input__slot fieldset legend {
    margin-left: 8px;
  }

  .v-tabs {
    height: 100%;

    .v-tabs-items {
      height: calc(100% - 30px);

      .v-window__container {
        height: 100%;
      }
    }
  }
}

.edit-header {
  position: relative;
  width: 100%;

  .enable-disable-switch {
    position: absolute;
    left: 12px;
    top: 0;
  }

}

.save-btn {
  position: absolute !important;
  right: 12px;
  bottom: 10px;
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
