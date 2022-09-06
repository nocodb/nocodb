<template>
  <v-container fluid>
    <v-card>
      <v-row>
        <!--        <v-col cols="12">-->
        <!--          <h4 class="text-center my-2 grey&#45;&#45;text text&#45;&#45;darken-2 title"> Metadata Management-->
        <!--          </h4></v-col>-->
        <v-col cols="8">
          <v-card class="pb-2">
            <v-toolbar flat height="50" class="toolbar-border-bottom">
              <v-text-field
                v-if="dbAliasList && db"
                v-model="filter"
                dense
                hide-details
                class="my-2 mx-auto"
                :placeholder="`Search '${db.connection.database}' models`"
                prepend-inner-icon="search"
                style="max-width: 500px"
                outlined
              />

              <v-spacer />
              <x-btn
                outlined
                :tooltip="$t('tooltip.reloadList')"
                small
                color="primary"
                icon="refresh"
                @click="
                  loadModels();
                  loadTableList();
                "
              >
                <!-- Reload -->
                {{ $t('general.reload') }}
              </x-btn>
              <x-btn
                outlined
                :loading="updating"
                :disabled="updating || !edited"
                :tooltip="$t('tooltip.saveChanges')"
                small
                color="primary"
                icon="save"
                @click="saveModels()"
              >
                <!-- Save -->
                {{ $t('general.save') }}
              </x-btn>
            </v-toolbar>

            <div class="d-flex d-100 justify-center">
              <v-simple-table dense style="min-width: 400px">
                <thead>
                  <tr>
                    <th class="grey--text">
                      Models
                      <span v-show="!isNewOrDeletedModelFound" class="caption ml-1">({{ enableCountText }})</span>
                    </th>
                    <!--                    <th>APIs</th>-->
                    <th class="grey--text">Actions</th>
                    <!--                    <th>Comment</th>-->
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <template v-for="model in comparedModelList">
                    <tr v-if="model.title.toLowerCase().indexOf(filter.toLowerCase()) > -1" :key="model.title">
                      <td>{{ model.title }}</td>
                      <!--                      <td>
                        <v-checkbox
                          v-model="model.enabled"
                          dense
                          :disabled="model.new || model.deleted"
                          @change="edited = true"
                        />
                      </td>-->
                      <td>
                        <template v-if="model.new">
                          <!--                  <x-icon small color="success success" tooltip="Add and sync meta information"-->
                          <!--                          @click="addTableMeta([model.title])">mdi-plus-circle-outline-->
                          <!--                  </x-icon>-->
                        </template>
                        <template v-else-if="model.deleted">
                          <!--                  <x-icon small v-else-if="model.deleted" color="error error" tooltip="Delete meta information"-->
                          <!--                          @click="deleteTableMeta([model.title])">mdi-delete-outline-->
                          <!--                  </x-icon>-->
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
                        <span v-if="model.new" class="caption success--text"
                          >New table found in DB. Yet to be synced.</span
                        >
                        <span v-else-if="model.deleted" class="caption error--text"
                          >This table doesn't exist in DB. Yet to be synced.</span
                        >
                        <!--                  <span v-else class="caption grey&#45;&#45;text">Recreate metadata.</span>-->
                      </td>
                    </tr>
                  </template>
                </tbody>
              </v-simple-table>
            </div>
          </v-card>
        </v-col>
        <v-col cols="4" style="padding-top: 100px">
          <div class="d-flex">
            <v-spacer />

            <v-tooltip bottom>
              <template #activator="{ on }">
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
                  Views metadata <br />is out of sync
                </v-alert>
                <v-alert v-else dense outlined type="success" v-on="on"> Views metadata is in sync </v-alert>
              </template>
              <template v-if="!isNewOrDeletedModelFound">
                Metadata for API creation & management is in sync with '{{ db.connection.database }}' Database.
              </template>
              <template v-else>
                Metadata for API creation & management isn't sync with '{{ db.connection.database }}' Database.
              </template>
            </v-tooltip>
            <v-spacer />
          </div>
          <div v-if="isNewOrDeletedModelFound" class="d-flex justify-center">
            <x-btn x-large btn.class="mx-auto primary" tooltip="Sync metadata" @click="syncMetadata">
              <v-icon color="white" class="mr-2 mt-n1"> mdi-database-sync </v-icon>
              Sync Now
            </x-btn>
          </div>
        </v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex';
import { isMetaTable } from '@/helpers/xutils';

export default {
  name: 'DisableOrEnableViews',
  props: ['nodes', 'db'],
  data: () => ({
    edited: false,
    models: null,
    updating: false,
    dbsTab: 0,
    filter: '',
    views: null,
  }),
  async mounted() {
    await this.loadModels();
    await this.loadTableList();
  },
  methods: {
    async addTableMeta(tables) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv'],
          },
          'viewMetaCreate',
          {
            viewNames: tables, // this.comparedModelList.filter(t => t.new).map(t=>t.title)
          },
        ]);
        setTimeout(async () => {
          await this.loadModels();
          this.$toast.success('Table metadata added successfully').goAway(3000);
        }, 1000);
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(5000);
      }
    },
    async deleteTableMeta(tables) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv'],
          },
          'viewMetaDelete',
          {
            tableNames: tables,
          },
        ]);
        setTimeout(async () => {
          await this.loadModels();
          this.$toast.success('Table metadata deleted successfully').goAway(3000);
        }, 1000);
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(5000);
      }
    },
    async syncMetadata() {
      const addTables = this.comparedModelList.filter(t => t.new).map(t => t.title);
      const deleteTables = this.comparedModelList.filter(t => t.deleted).map(t => t.title);
      if (addTables.length) {
        await this.addTableMeta(addTables);
      }
      if (deleteTables.length) {
        await this.deleteTableMeta(deleteTables);
      }
    },

    async recreateTableMeta(table) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv'],
          },
          'viewMetaRecreate',
          {
            tn: table,
          },
        ]);
        setTimeout(async () => {
          await this.loadModels();
          this.$toast.success('Table metadata recreated successfully').goAway(3000);
        }, 1000);
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(5000);
      }
    },
    async loadModels() {
      if (this.dbAliasList[this.dbsTab]) {
        this.models = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv'],
          },
          'xcViewModelsList',
        ]);
        this.edited = false;
      }
    },
    async loadTableList() {
      this.views = (
        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv'],
          },
          'viewList',
          { force: true },
        ])
      ).data.list;
    },

    async saveModels() {
      this.updating = true;
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.db.meta.dbAlias,
            env: this.$store.getters['project/GtrEnv'],
          },
          'xcViewModelsEnable',
          this.models.filter(m => m.enabled).map(m => m.title),
        ]);
        this.$toast.success('Models changes are updated successfully').goAway(3000);
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(3000);
        console.log(e.message);
      }
      this.updating = false;
      this.edited = false;
    },
  },
  computed: {
    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList',
    }),
    enableCountText() {
      return this.models ? `${this.models.filter(m => m.enabled).length}/${this.models.length} enabled` : '';
    },

    isNewOrDeletedModelFound() {
      return this.comparedModelList.some(m => m.new || m.deleted);
    },
    comparedModelList() {
      const res = [];
      const getPriority = item => {
        if (item.new) {
          return 2;
        }
        if (item.deleted) {
          return 1;
        }
        return 0;
      };
      if (this.views && this.models) {
        const tables = this.views.filter(t => !isMetaTable(t.view_name)).map(t => t.view_name);
        res.push(
          ...this.models.map(m => {
            const i = tables.indexOf(m.title);
            if (i === -1) {
              m.deleted = true;
            } else {
              tables.splice(i, 1);
            }
            return m;
          })
        );
        res.push(
          ...tables.map(t => ({
            title: t,
            new: true,
          }))
        );
      }
      res.sort((a, b) => getPriority(b) - getPriority(a));
      return res;
    },
  },
};
</script>

<style scoped></style>
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
