<template>
  <v-container v-if="db" fluid>
    <v-card>
      <v-card class="pb-2">
        <v-toolbar flat height="50" class="toolbar-border-bottom">
          <v-text-field
            v-if="db"
            v-model="filter"
            dense
            hide-details
            class="my-2 mx-auto search-field"
            :placeholder="`Search '${db.connection.database}' models`"
            style="max-width:300px"
            outlined
          >
            <template #prepend-inner>
              <v-icon small>
                search
              </v-icon>
            </template>
          </v-text-field>

          <v-spacer />
          <x-btn
            outlined
            tooltip="Reload list"
            small
            color="primary"
            icon="refresh"
            class="nc-acl-reload"
            @click="loadTableList()"
          >
            Reload
          </x-btn>
          <x-btn
            outlined
            :loading="updating"
            :disabled="updating || !edited"
            tooltip="Save Changes"
            small
            color="primary"
            icon="save"
            class="nc-acl-save"
            @click="save()"
          >
            Save
          </x-btn>
        </v-toolbar>

        <div class="d-flex d-100 justify-center">
          <v-simple-table v-if="tables" dense style="min-width: 400px">
            <thead>
              <tr>
                <th class="caption" bgcolor="#F5F5F5" width="100px">
                  TableName
                </th>
                <th class="caption" bgcolor="#F5F5F5" width="150px">
                  ViewName
                </th>
                <th v-for="role in roles" :key="role" class="caption" bgcolor="#F5F5F5" width="100px">
                  {{ role.charAt(0).toUpperCase() + role.slice(1) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="table in tables"
              >
                <tr
                  v-if="table._tn.toLowerCase().indexOf(filter.toLowerCase()) > -1"
                  :key="table.tn"
                  :class="`nc-acl-table-row nc-acl-table-row-${table._tn}`"
                >
                  <td>
                    <v-tooltip bottom>
                      <template #activator="{on}">
                        <span class="caption ml-2" v-on="on">{{ table.type === 'table' ? table._tn:table.type === 'view' ? table._tn : table.ptn.charAt(0).toUpperCase()+table.ptn.slice(1) }}</span>
                      </template>
                      <span class="caption">{{ table.tn }}</span>
                    </v-tooltip>
                  </td>
                  <td>
                    <v-icon small :color="viewIcons[table.type === 'vtable' ? table.show_as : table.type].color" v-on="on">
                      {{ viewIcons[table.type === 'vtable' ? table.show_as : table.type].icon }}
                    </v-icon>
                    <span v-if="table.ptn" class="caption">{{ table._tn }}</span>
                    <span v-else class="caption">{{ 'Default' }}</span>
                    <!--                    {{ table.show_as || table.type }}-->
                  </td>
                  <td v-for="role in roles" :key="`${table.tn}-${role}`">
                    <v-tooltip bottom>
                      <template #activator="{on}">
                        <div
                          v-on="on"
                        >
                          <v-checkbox
                            v-model="table.disabled[role]"
                            :class="`pt-0 mt-0 nc-acl-${table._tn.toLowerCase().replace('_','')}-${role}-chkbox`"
                            dense
                            hide-details
                            :true-value="false"
                            :false-value="true"
                            @change="$set(table,'edited',true)"
                          />
                        </div>
                      </template>

                      <span v-if="table.disabled[role]">Click to make '{{ table.tn }}' visible for Role:{{
                        role
                      }} in UI dashboard</span>
                      <span v-else>Click to hide '{{ table.tn }}' for Role:{{ role }} in UI dashboard</span>
                    </v-tooltip>
                  </td>
                </tr>
              </template>
            </tbody>
          </v-simple-table>
          <v-skeleton-loader v-else type="table" />
        </div>
      </v-card>
    </v-card>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'
import viewIcons from '~/helpers/viewIcons'

export default {
  name: 'ToggleTableUiAcl',
  components: {},
  props: ['nodes', 'db'],
  data: () => ({
    viewIcons,
    models: null,
    updating: false,
    dbsTab: 0,
    filter: '',
    tables: null
  }),
  async mounted() {
    await this.loadTableList()
  },
  methods: {
    async loadTableList() {
      this.tables = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        dbAlias: this.db.meta.dbAlias,
        env: this.$store.getters['project/GtrEnv']
      }, 'xcVisibilityMetaGet', {
        type: 'all'
      }]))
    },
    async save() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.db.meta.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'xcVisibilityMetaSetAll', {
          disableList: this.tables.filter(t => t.edited)
        }])
        this.$toast.success('Updated UI ACL for tables successfully').goAway(3000)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  },
  computed: {
    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList'
    }),
    edited() {
      return this.tables && this.tables.length && this.tables.some(t => t.edited)
    },
    roles() {
      return this.tables && this.tables.length ? Object.keys(this.tables[0].disabled) : []
    }
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

  .search-field.v-text-field > .v-input__control, .search-field.v-text-field > .v-input__control > .v-input__slot {
    min-height: auto;
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
