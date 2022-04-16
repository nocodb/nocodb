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
            placeholder="Search models"
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
            :tooltip="$t('tooltip.reloadList')"
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
            :tooltip="$t('tooltip.saveChanges')"
            small
            color="primary"
            icon="save"
            class="nc-acl-save"
            @click="save()"
          >
            <!-- Save -->
            {{ $t('general.save') }}
          </x-btn>
        </v-toolbar>

        <div class="d-flex d-100 justify-center">
          <v-simple-table v-if="tables" dense style="min-width: 400px">
            <thead>
              <tr>
                <th class="caption" width="100px">
                  <!--TableName-->
                  {{ $t('labels.tableName') }}
                </th>
                <th class="caption" width="150px">
                  <!--ViewName-->
                  {{ $t('labels.viewName') }}
                </th>
                <th v-for="role in roles" :key="role" class="caption" width="100px">
                  {{ role.charAt(0).toUpperCase() + role.slice(1) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="table in tables"
              >
                <tr
                  v-if="table.title.toLowerCase().indexOf(filter.toLowerCase()) > -1"
                  :key="table.table_name"
                  :class="`nc-acl-table-row nc-acl-table-row-${table.title}`"
                >
                  <td>
                    <v-tooltip bottom>
                      <template #activator="{on}">
                        <span
                          class="caption ml-2"
                          v-on="on"
                        >{{ table.ptype === 'table' ? table._ptn : table.ptype === 'view' ? table._ptn : table._ptn }}</span>
                      </template>
                      <span class="caption">{{ table.ptn || table._ptn }}</span>
                    </v-tooltip>
                  </td>
                  <td>
                    <v-icon small :color="viewIcons[table.type].color" v-on="on">
                      {{ viewIcons[table.type].icon }}
                    </v-icon>
                    <span v-if="table.ptn" class="caption">{{ table.title }}</span>
                    <span v-else class="caption">{{ $t('general.default') }}</span>
                    <!--                    {{ table.show_as || table.type }}-->
                  </td>
                  <td v-for="role in roles" :key="`${table.table_name}-${role}`">
                    <v-tooltip bottom>
                      <template #activator="{on}">
                        <div
                          v-on="on"
                        >
                          <v-checkbox
                            v-model="table.disabled[role]"
                            :class="`pt-0 mt-0 nc-acl-${table.title.toLowerCase().replace('_','')}-${role}-chkbox`"
                            dense
                            hide-details
                            :true-value="false"
                            :false-value="true"
                            @change="$set(table,'edited',true)"
                          />
                        </div>
                      </template>

                      <span v-if="table.disabled[role]">Click to make '{{ table.table_name }}' visible for Role:{{
                        role
                      }} in UI dashboard</span>
                      <span v-else>Click to hide '{{ table.table_name }}' for Role:{{ role }} in UI dashboard</span>
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
      this.tables = (await this.$api.project.modelVisibilityList(
        this.db.project_id, {
          includeM2M: this.$store.state.windows.includeM2M || ''
        }))
      // this.tables = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
      //   dbAlias: this.db.meta.dbAlias,
      //   env: this.$store.getters['project/GtrEnv']
      // }, 'xcVisibilityMetaGet', {
      //   type: 'all'
      // }]))
    },
    async save() {
      try {
        await this.$api.project.modelVisibilitySet(this.db.project_id, this.tables.filter(t => t.edited))
        this.$toast.success('Updated UI ACL for tables successfully').goAway(3000)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit('proj-meta:ui-acl:update')
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
      return ['editor', 'commenter', 'viewer']// this.tables && this.tables.length ? Object.keys(this.tables[0].disabled) : []
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
