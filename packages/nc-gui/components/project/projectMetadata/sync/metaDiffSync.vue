<template>
  <v-container fluid>
    <v-card>
      <v-row>
        <!--                    <v-col cols="12">-->
        <!--                      <h4 class="text-center my-2 grey&#45;&#45;text text&#45;&#45;darken-2 title"> Metadata Management-->
        <!--                      </h4></v-col>-->
        <v-col cols="8">
          <v-card class="pb-2">
            <v-toolbar flat height="50" class="toolbar-border-bottom">
              <v-text-field
                v-if="dbAliasList && dbAliasList[dbsTab]"
                v-model="filter"
                dense
                hide-details
                class="my-2 mx-auto caption"
                :placeholder="$t('placeholder.searchModels')"
                prepend-inner-icon="search"
                style="max-width:500px"
                outlined
              />

              <v-spacer />
              <x-btn
                btn.class="nc-btn-metasync-reload"
                outlined
                :tooltip="$t('tooltip.reloadList')"
                small
                color="primary"
                icon="refresh"
                @click="clickReload"
              >
                <!-- Reload -->
                {{ $t('general.reload') }}
              </x-btn>
              <!--              <x-btn
                outlined
                :tooltip="$t('tooltip.reloadList')"
                small
                color="primary"
                icon="refresh"
                @click="loadModels();loadTableList()"
              >
                {{ $t('general.reload') }}
              </x-btn>-->
              <!--x-btn
                outlined
                :loading="updating"
                :disabled="updating || !edited"
                :tooltip="$t('tooltip.saveChanges')"
                small
                color="primary"
                icon="save"
                @click="saveModels()"
              >
                Save
              </!--x-btn-->
            </v-toolbar>

            <div class="d-flex d-100 justify-center">
              <v-simple-table dense style="min-width: 400px">
                <thead>
                  <tr>
                    <th class="grey--text">
                      <!--Models-->
                      {{ $t('labels.models') }}
                    </th>
                    <!--                    <th>APIs</th>-->
                    <th class="grey--text">
                      <!--Sync state-->
                      {{ $t('labels.syncState') }}
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="model in diff"
                    v-show="!filter.trim() || (model.table_name || model.title || '').toLowerCase().includes(filter.toLowerCase())"
                    :key="model.table_name"
                    :class="`nc-metasync-row nc-metasync-row-${model.table_name}`"
                  >
                    <!--                    v-if="model.alias.toLowerCase().indexOf(filter.toLowerCase()) > -1">-->
                    <td>
                      <!--                      <v-icon small :color="viewIcons[model.type==='table'?'grid':'view'].color" v-on="on">
                        {{ viewIcons[model.type === 'table' ? 'grid' : 'view'].icon }}
                      </v-icon>-->
                      <v-tooltip bottom>
                        <template #activator="{on}">
                          <span v-on="on">{{ model.table_name && model.table_name.slice(prefix.length) }}</span>
                        </template>
                        <span class="caption">{{ model.title }}</span>
                      </v-tooltip>
                    </td>
                    <!--                    <td>
            <v-checkbox
              v-model="model.enabled"
              dense
              :disabled="model.new || model.deleted"
              @change="edited = true"
            />
          </td>-->
                    <!--td>
                <x-icon
                  small
                  color="primary"
                  tooltip="Recreate metadata"
                >
                  mdi-reload
                </x-icon>
              </!--td-->

                    <td>
                      <span
                        v-if="model.detectedChanges && model.detectedChanges.length"

                        class="caption error--text"
                      >{{ model.detectedChanges.map(m => m.msg).join(', ') }}</span>
                      <span
                        v-else
                        class="caption grey--text"
                      >
                        <!--{{ 'No change identified' }}-->
                        {{ $t('msg.info.metaNoChange') }}
                      </span>
                    <!--                  <span v-else class="caption grey&#45;&#45;text">Recreate metadata.</span>-->
                    </td>
                  </tr>
                </tbody>
              </v-simple-table>
              <!--            </div>  <div class="d-flex d-100 justify-center">
              <v-simple-table dense style="min-width: 400px">
                <thead>
                  <tr>
                    <th class="grey&#45;&#45;text">
                      Models <span v-show="!isNewOrDeletedModelFound" class="caption ml-1">({{
                        enableCountText
                      }})</span>
                    </th>
                    &lt;!&ndash;                    <th>APIs</th>&ndash;&gt;
                    <th class="grey&#45;&#45;text">
                      Actions
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="model in comparedModelList" :key="model.title">
                    &lt;!&ndash;                    v-if="model.alias.toLowerCase().indexOf(filter.toLowerCase()) > -1">&ndash;&gt;
                    <td>
                      <v-tooltip bottom>
                        <template #activator="{on}">
                          <span v-on="on">{{ model.alias }}</span>
                        </template>
                        <span class="caption">{{ model.title }}</span>
                      </v-tooltip>
                    </td>
                    &lt;!&ndash;                    <td>
                    <v-checkbox
                      v-model="model.enabled"
                      dense
                      :disabled="model.new || model.deleted"
                      @change="edited = true"
                    />
                  </td>&ndash;&gt;
                    <td>
                      <template v-if="model.new">
                      &lt;!&ndash;                  <x-icon small color="success success" tooltip="Add and sync meta information"&ndash;&gt;
                      &lt;!&ndash;                          @click="addTableMeta([model.title])">mdi-plus-circle-outline&ndash;&gt;
                      &lt;!&ndash;                  </x-icon>&ndash;&gt;
                      </template>
                      <template v-else-if="model.deleted">
                      &lt;!&ndash;                  <x-icon small v-else-if="model.deleted" color="error error" tooltip="Delete meta information"&ndash;&gt;
                      &lt;!&ndash;                          @click="deleteTableMeta([model.title])">mdi-delete-outline&ndash;&gt;
                      &lt;!&ndash;                  </x-icon>&ndash;&gt;
                      </template>
                      <x-icon
                        v-else
                        small
                        color="primary"
                        tooltip="Recreate metadata"
                        @click="recreateTableMeta(model.title)"
                      >
                        mdi-reload
                      </x-icon>
                    </td>

                    <td>
                      <span
                        v-if="model.new"
                        class="caption success&#45;&#45;text"
                      >New table found in DB. Yet to be synced.</span>
                      <span v-else-if="model.deleted" class="caption error&#45;&#45;text">This table doesn't exist in DB. Yet to be synced.</span>
                    &lt;!&ndash;                  <span v-else class="caption grey&#45;&#45;text">Recreate metadata.</span>&ndash;&gt;
                    </td>
                  </tr>
                </tbody>
              </v-simple-table>
            </div>-->
            </div>
          </v-card>
        </v-col>
        <v-col cols="4" style="padding-top:100px">
          <div class="d-flex">
            <v-spacer />

            <!--            <v-tooltip bottom>-->
            <!-- template #activator="{on}">
                <v-alert
                  v-if="isNewOrDeletedModelFound"
                  dense
                  border="left"
                  colored-border
                  elevation="2"
                  color="warning"
                  type="warning"
                  v-on="on"
                >
                  Tables metadata <br>is out of sync
                </v-alert>
                <v-alert
                  v-else
                  dense
                  outlined
                  type="success"
                  v-on="on"
                >
                  Tables metadata is in sync
                </v-alert>
              </template>
              <template v-if="!isNewOrDeletedModelFound">
                Metadata for API creation & management is in sync with
                '{{ dbAliasList[dbsTab].connection.database }}' Database.
              </template>
              <template-- v-else>
                Metadata for API creation & management isn't sync with
                '{{ dbAliasList[dbsTab].connection.database }}' Database.
              </template-->
            <!--            </v-tooltip>-->
            <v-spacer />
          </div>
          <!--          <div-->
          <!--            v-if="isNewOrDeletedModelFound" -->
          <div class="d-flex justify-center">
            <v-btn
              v-if="isChanged"
              v-t="['proj-meta:metadata:metasync']"
              x-large
              class="mx-auto primary nc-btn-metasync-sync-now"
              @click="syncMetaDiff"
            >
              <v-icon color="white" class="mr-2 mt-n1">
                mdi-database-sync
              </v-icon>
              Sync Now
            </v-btn>

            <v-alert
              v-else
              dense
              outlined
              type="success"
            >
              Tables metadata is in sync
            </v-alert>
          </div>
        </v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'
import viewIcons from '~/helpers/viewIcons'

export default {
  name: 'DisableOrEnableTables',
  props: ['nodes', 'db'],
  data: () => ({
    viewIcons,
    edited: false,
    models: null,
    updating: false,
    dbsTab: 0,
    filter: '',
    tables: null,
    diff: null
  }),
  async mounted() {
    await this.loadXcDiff()
    // await this.loadMode// await this.loadTableList()
  },
  methods: {
    async loadXcDiff() {
      this.diff = (await this.$api.project.metaDiffGet(this.$store.state.project.projectId, this.db.id))

      // this.diff = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
      //   dbAlias: this.db.meta.dbAlias,
      //   env: this.$store.getters['project/GtrEnv']
      // }, 'xcMetaDiff'])
    },
    clickReload() {
      this.loadXcDiff()
      this.$tele.emit('proj-meta:metadata:reload')
    },
    /* async addTableMeta(tables) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.db.meta.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'tableMetaCreate', {
          tableNames: tables// this.comparedModelList.filter(t => t.new).map(t=>t.title)
        }])
        setTimeout(async() => {
          await this.loadModels()
          this.$toast.success('Table metadata added successfully').goAway(3000)
        }, 1000)
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(5000)
      }
    },
    async deleteTableMeta(tables) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.db.meta.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'tableMetaDelete', {
          tableNames: tables
        }])
        setTimeout(async() => {
          await this.loadModels()
          this.$toast.success('Table metadata deleted successfully').goAway(3000)
        }, 1000)
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(5000)
      }
    },
    async syncMetadata() {
      const addTables = this.comparedModelList.filter(t => t.new).map(t => t.title)
      const deleteTables = this.comparedModelList.filter(t => t.deleted).map(t => t.title)
      if (addTables.length) {
        await this.addTableMeta(addTables)
      }
      if (deleteTables.length) {
        await this.deleteTableMeta(deleteTables)
      }
    },
*/
    async syncMetaDiff() {
      try {
        await this.$api.project.metaDiffSync(this.$store.state.project.projectId, this.db.id)
        // await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        //   dbAlias: this.db.meta.dbAlias,
        //   env: this.$store.getters['project/GtrEnv']
        // }, 'xcMetaDiffSync', {}])
        this.$toast.success('Table metadata recreated successfully').goAway(3000)
        await this.loadXcDiff()

        this.$store.commit('tabs/removeTableOrViewTabs')
        await this.$nextTick()
        await this.$store.dispatch('project/_loadTables', {
          dbKey: '0.projectJson.envs._noco.db.0',
          key: '0.projectJson.envs._noco.db.0.tables',
          _nodes: {
            dbAlias: 'db',
            env: '_noco',
            type: 'tableDir'
          }
        })
        await this.$store.commit('meta/MutClear')
      } catch (e) {
        this.$toast[e.response?.status === 402 ? 'info' : 'error'](e.message).goAway(3000)
      }
    }

    /*  async recreateTableMeta(table) {
        try {
          await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv']
          }, 'tableMetaRecreate', {
            tn: table
          }])
          setTimeout(async() => {
            await this.loadModels()
            this.$toast.success('Table metadata recreated successfully').goAway(3000)
          }, 1000)
        } catch (e) {
          this.$toast[e.response?.status === 402 ? 'info' : 'error'](e.message).goAway(3000)
        }
      },
      async loadModels() {
        if (this.dbAliasList[this.dbsTab]) {
          this.models = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv']
          }, 'xcTableModelsList'])
          this.edited = false
        }
      },
      async loadTableList() {
        this.tables = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.db.meta.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'tableList', { force: true, includeM2M: true }])).data.list
      },

      async saveModels() {
        this.updating = true
        try {
          await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv']
          }, 'xcTableModelsEnable', this.models.filter(m => m.enabled).map(m => m.title)])
          this.$toast.success('Models changes are updated successfully').goAway(3000)
        } catch (e) {
          this.$toast[e.response?.status === 402 ? 'info' : 'error'](e.message).goAway(3000)
          console.log(e.message)
        }
        this.updating = false
        this.edited = false
      } */
  },
  computed: {
    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList'
    }),
    isChanged() {
      return this.diff && this.diff.some(d => d && d.detectedChanges && d.detectedChanges.length)
    },
    prefix() {
      return this.$store.getters['project/GtrProjectPrefix'] || ''
    }
    /* enableCountText() {
      return this.models
        ? `${this.models.filter(m => m.enabled).length}/${this.models.length} enabled`
        : ''
    },

    isNewOrDeletedModelFound() {
      return this.comparedModelList.some(m => m.new || m.deleted)
    },
    comparedModelList() {
      const res = []
      const getPriority = (item) => {
        if (item.new) {
          return 2
        }
        if (item.deleted) {
          return 1
        }
        return 0
      }
      if (this.tables && this.models) {
        const tables = this.tables.filter(t => !isMetaTable(t.table_name)).map(t => t.table_name)
        res.push(...this.models.map((m) => {
          const i = tables.indexOf(m.title)
          if (i === -1) {
            m.deleted = true
          } else {
            tables.splice(i, 1)
          }
          return m
        }))
        res.push(...tables.map(t => ({
          title: t, new: true, alias: t
        })))
      }
      res.sort((a, b) => getPriority(b) - getPriority(a))
      return res
    } */
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-tabs-bar {
    border-bottom: solid 1px #7f828b33;
  }

  .v-tab {
    border-right: 1px solid #7f828b33;
  }
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
