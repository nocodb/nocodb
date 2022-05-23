<template>
  <div class="">
    <v-overlay v-if="isMetaTable" absolute>
      <v-alert type="info">
        Meta tables are not editable
      </v-alert>
    </v-overlay>
    <v-card class="elevation-0">
      <v-toolbar height="42" flat class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs
            :items="[{
                       text: nodes.env,
                       disabled: true,
                       href: '#'
                     },{
                       text: nodes.dbAlias,
                       disabled: true,
                       href: '#'
                     },
                     {
                       text: nodes.view_name + ' (view)',
                       disabled: true,
                       href: '#'
                     }]"
            divider=">"
            small
            class="title"
          >
            <template #divider>
              <v-icon small color="grey lighten-2">
                forward
              </v-icon>
            </template>
          </v-breadcrumbs>
        </v-toolbar-title>
        <v-spacer />

        <x-btn
          v-ge="['columns','reload']"
          tooltip="Reload Columns from database"
          outlined
          color="primary"
          small
          @click="loadColumnList"
        >
          <v-icon small left>
            refresh
          </v-icon>
          Re<u>l</u>oad
        </x-btn>
      </v-toolbar>
      <div class="d-flex justify-center">
        <v-data-table
          dense
          :headers="headers"
          :items="columns"
          hide-default-header
          class=" column-table flex-shrink-1"
          style="min-width:60%"
        >
          <template #header="{props:{headers}}">
            <tr>
              <th
                v-for="header in headers"
                :key="header.title"
                class="pt-2 pb-0 text-center"
                style="white-space: nowrap;"
                :style="{minWidth:header.width,width:header.width}"
              >
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <span v-on="on">{{ header.text }}</span>
                  </template>
                  <span>{{ header.title }}</span>
                </v-tooltip>
              </th>
            </tr>
          </template>

          <template #item="props">
            <tr :disabled="nodes.view_name==='_evolutions' || nodes.view_name==='nc_evolutions'">
              <td
                ref="column"
                :title="props.item.column_name"
                style="width:200px"
              >
                <div class="d-flex">
                  &nbsp;
                  <v-icon
                    small
                    :class="{
                      'green--text' : props.item.pk
                    }"
                  >
                    {{ getColumnIcon(props.item) }}
                  </v-icon>&nbsp;
                  {{ props.item.column_name }}
                </div>
              </td>
              <td class="pa-0 text-center">
                {{ props.item.dt }}
              </td>
              <td class="pa-0 text-center">
                {{ props.item.dtxp }}
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </v-card>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  components: {},
  data() {
    return {
      columns: [],
      dataTypes: [],
      headers: [
        {
          text: 'Column',
          title: 'Column name',
          value: 'cn',
          sortable: false,
          width: '1%'
        },
        { text: 'Data Type', title: 'Data Type', value: 'dt', sortable: false, width: '10%' },
        { text: 'Length/Values', title: 'Length/Values', value: 'dt', sortable: false, width: '5%' }
      ]
    }
  },
  methods: {
    getColumnIcon(column) {
      if (column.pk) {
        return 'mdi-key'
      } else if (column.rcn) {
        return 'mdi-link-variant'
      } else {
        return 'mdi-gate-or'
      }
    },

    async loadColumnList() {
      this.$store.commit('notification/MutToggleProgressBar', true)
      try {
        this.edited = false
        if (this.newTable) {
          this.columns = this.sqlUi.getNewTableColumns()
          return
        }

        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'columnList', {
          table_name: this.nodes.view_name
        }])
        console.log('table ', result.data.list)
        const columns = result.data.list

        this.columns = JSON.parse(JSON.stringify(columns))
        this.originalColumns = [...columns]
        console.log(this.columns)
      } catch (e) {
        console.log(e)
        this.$toast.error('Error loading columns :' + e).goAway(4000)
        throw e
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false)
      }
    },
    async loadDataTypes() {
      try {
        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'getKnexDataTypes', {}])

        this.dataTypes = result.data.list
      } catch (e) {
        this.$toast.error('Error loading datatypes :' + e).goAway(4000)
        throw e
      }
    }

  },
  computed: {
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      currentProjectFolder: 'project/currentProjectFolder',
      projectIsGraphql: 'project/GtrProjectIsGraphql',
      isNoApis: 'project/GtrProjectIsNoApis',
      isMvc: 'project/GtrIsMvc'
    })
  },

  beforeCreated() {
  },
  watch: {},
  async created() {
    // try {
    await this.loadColumnList()
    // } catch (e) {
    //   throw e
    // } finally {
    //
    // }
  },
  mounted() {

  },
  beforeDestroy() {
  },
  destroy() {
  },
  directives: {},
  validate({ params }) {
    return true
  },
  head() {
    return {}
  },
  props: ['nodes', 'newTable', 'mtdNewTableUpdate', 'deleteTable', 'isMetaTable']
}
</script>

<style scoped>
/* to apply 6-9 columns */
/deep/ .column-table td:nth-child(n+5):not(:nth-child(n+10)),
/deep/ .column-table th:nth-child(n+5):not(:nth-child(n+10)) {
  width: 30px;
  padding: 0;
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
