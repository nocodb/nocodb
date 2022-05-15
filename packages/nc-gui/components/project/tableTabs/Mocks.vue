<template>
  <div class="">
    <v-card style="">
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
                       text: nodes.table_name + ' (mocks)',
                       disabled: true,
                       href: '#'
                     }]"
            divider=">"
            small
          >
            <template #divider>
              <v-icon small>
                forward
              </v-icon>
            </template>
          </v-breadcrumbs>
        </v-toolbar-title>
        <v-spacer />
        <x-btn
          v-ge="['mocks','load']"
          outlined
          tooltip="Reload Rows"
          small
          color="primary"
          class="primary"
          @click="loadColumnList"
        >
          <v-icon small left>
            refresh
          </v-icon>
          <!-- Reload -->
          {{ $t('general.reload') }}
        </x-btn>

        <x-btn
          v-ge="['mocks','load-faker-fns']"
          outlined
          tooltip="Load suggested faker function based on field name"
          color="primary"
          class="primary"
          small
          @click="mapFieldWithSuggestedFakerFn"
        >
          <v-icon left small>
            mdi-function
          </v-icon>
          Predict Faker Functions
        </x-btn>

        <x-btn
          v-ge="['mocks','save']"
          outlined
          :tooltip="$t('tooltip.saveChanges')"
          color="success"
          class="success"
          small
          :disabled="disableSaveButton"
          @click="saveFakeFunctions"
        >
          <v-icon
            small
            left
          >
            save
          </v-icon>
          <!-- Save -->
          {{ $t('general.save') }}
        </x-btn>
      </v-toolbar>

      <v-data-table
        dense
        :headers="colsHeader"
        :items="cols"
        class="column-table"
      >
        <template #item="{item}">
          <tr>
            <td>
              {{ item.column_name }}<span class="font-weight-thin"> - {{ item.dt }}</span>
            </td>
            <td>
              <span v-if="item.pk" class="font-weight-thin"> (Primary Key)</span>
              <span v-else-if="item.rcn" class="font-weight-thin"> (Foreign Key)</span>
              <v-autocomplete
                v-else
                v-model="item.fakerFunction"
                v-ge="['mocks','change-faker-fn']"
                :items="fakerFunctionList | filterFakerList(item.dt)"
                item-text="name"
                item-value="value"
                @change="disableSaveButton = false"
              >
                <template #selection="{ item }">
                  <div class="body-2">
                    {{ item.name }}<span v-if="item.type" class="font-weight-thin "> &nbsp;- {{ item.type }}</span>
                  </div>
                </template>

                <template #item="data">
                  <v-list-item-content>
                    <v-list-item-title v-html="data.item.name" />
                    <v-list-item-subtitle v-html="data.item.group" />
                  </v-list-item-content>
                </template>
              </v-autocomplete>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import fakerFunctionList from '../../../helpers/fakerFunctionList'
import dataTypeMapping from '../../../helpers/findDataTypeMapping'
const levenshtein = require('fast-levenshtein')

export default {
  components: {},
  data() {
    return {
      colsHeader: [{ text: 'Column Name' }, { text: 'Mapper Function' }],
      cols: [],
      primaryKeys: [],
      fakerFunctionList,
      disableSaveButton: true
    }
  },
  methods: {
    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        case 'true_s' :
          await this.saveFakeFunctions()
          break
        case 'true_l' :
          await this.loadColumnList()
          break
          // case 'true_n' :
          //   this.addColumn();
          //   break;
          // case 'true_d' :
          //   await this.deleteTable('showDialog');
          //   break;
      }
    },

    async loadColumnList() {
      this.disableSaveButton = true
      const columnsList = await this.client.fakerColumnsList({
        table_name: this.nodes.table_name,
        seedsFolder: this.seedsFolder
      })
      console.log(columnsList)
      this.cols = columnsList.data.list

      // columnsList.data.list.map(({cn, dt, ai, pk}) => {
      //   if (pk) this.primaryKeys.push(cn);
      //   return {
      //     text: cn, value: cn, type: dt, ai
      //   }
      // })
    },
    mapFieldWithSuggestedFakerFn() {
      this.cols = this.cols.map((col) => {
        let suggestion = null
        let lScore = Infinity
        const nativeType = dataTypeMapping(col.dt)
        fakerFunctionList.forEach((fakerFn, i) => {
          if (nativeType !== 'string' && nativeType !== fakerFn.type) { return }

          if (i) {
            const ls = levenshtein.get(col.column_name.toLowerCase(), fakerFn.name.toLowerCase())
            if (lScore > ls) {
              lScore = ls
              suggestion = fakerFn
            }
          } else {
            suggestion = fakerFn
            lScore = levenshtein.get(col.column_name.toLowerCase(), fakerFn.name.toLowerCase())
          }
        })

        if (lScore < 3) {
          this.disableSaveButton = false
          return { ...col, fakerFunction: suggestion.value }
        }
        return col
      })
    },
    async saveFakeFunctions() {
      try {
        await this.client.fakerColumnsCreate({ fakerColumns: this.cols, seedsFolder: this.seedsFolder, table_name: this.nodes.table_name })
      } catch (e) {
        this.$toast.error('Saving changes to faker functions failed').goAway(3000)
        throw e
      }
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' })
  },
  beforeCreated() {
  },
  watch: {},
  async created() {
    try {
      this.seedsFolder = this.sqlMgr.projectGetFolder({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      })
      this.client = await this.sqlMgr.projectGetSqlClient({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      })
      await this.loadColumnList()
    } catch (e) {
      console.log(e)
      this.$toast.error('Loading columns and faker functions failed').goAway(3000)
      throw e
    }
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  directives: {},
  filters: {
    filterFakerList(list, type) {
      const nativeType = dataTypeMapping(type)
      return list.filter(item => (nativeType === 'string') || (nativeType === item.type))
    }
  },
  validate({ params }) {
    return true
  },
  head() {
    return {}
  },
  props: ['nodes', 'newTable', 'mtdNewTableUpdate', 'deleteTable']
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
