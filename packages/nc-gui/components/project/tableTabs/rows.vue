<template>
  <div class="">
    <v-card class="elevation-0">
      <v-toolbar flat height="42" class="toolbar-border-bottom">
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
                       text: (nodes.table_name || nodes.view_name) + ' (rows)',
                       disabled: true,
                       href: '#'
                     }]"
            divider=">"
            small
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
          v-ge="['rows','reload']"
          outlined
          tooltip="Reload Rows"
          color="primary"
          small
          @click="refreshTable"
        >
          <v-icon small left>
            refresh
          </v-icon>
          <!-- Reload -->
          {{ $t('general.reload') }}
        </x-btn>
        <x-btn
          v-if="!isView"
          v-ge="['rows','save']"
          outlined
          :tooltip="$t('tooltip.saveChanges')"
          color="primary"
          class="primary"
          small
          :disabled="disableSaveButton"
          @click.prevent="saveChanges"
        >
          <v-icon small left>
            save
          </v-icon>
          <!-- Save -->
          {{ $t('general.save') }}
        </x-btn>
        <x-btn
          v-if="!isView"
          v-ge="['rows','new']"
          outlined
          tooltip="Add New Row"
          color="primary"
          class="primary"
          small
          @click="addNewRow"
        >
          <v-icon small left>
            mdi-plus
          </v-icon>
          New Row
        </x-btn>
      </v-toolbar>

      <v-data-table
        :disable-sort="true"
        :server-items-length="totalCount"
        dense
        :headers="cols"
        :items="rows"
        hide-default-header
        :options.sync="tableOptions"
        class=" column-table"
        :footer-props="{
          itemsPerPageOptions:[5,10,25,50,100]
        }"
      >
        <template #header="{props:{headers}}">
          <th v-for="header in headers" :key="header.title" class="py-2 px-1 text-center text-capitalize">
            {{ header.text }}
          </th>
        </template>

        <template #item="{item,index}">
          <tr v-if="!item.isNewRow">
            <td v-for="({text,type,ai:ai},i) in cols" :key="i" class="caption">
              <span v-if="isView">
                {{ item.data[text] }}
              </span>
              <template v-else-if="text">
                <v-edit-dialog

                  v-ge="['rows','edit-save']"
                  :return-value.sync="item.data[text]"
                  @save="save(type,text,item)"
                >
                  {{ item.data[text] }}
                  <template #input>
                    <v-text-field
                      v-model="item.data[text]"
                      class="mt-0 caption"
                      :label="$t('general.edit')"
                      :type="getType(type)"
                      single-line
                      hide-details
                      dense
                      :disabled="ai"
                    />
                  </template>
                </v-edit-dialog>
              </template>
              <template v-else>
                <x-icon
                  v-ge="['rows','delete']"
                  small
                  color="error grey"
                  @click="deleteRow('showDialog', index, item)"
                >
                  mdi-delete-forever
                </x-icon>
              </template>
            </td>
          </tr>
          <tr v-else>
            <td v-for="({text,type,ai:ai},i) in cols" :key="i">
              <template v-if="text">
                <v-text-field
                  v-model="item.data[text]"
                  v-ge="['rows','save']"
                  dense
                  hide-details
                  :label="$t('general.edit')"
                  :type="getType(type)"
                  :placeholder="text"
                  :disabled="ai"
                  single-line
                  class="caption mt-n1 "
                  @input.passive="save(type,text,item)"
                />
              </template>
              <template v-else>
                <x-icon
                  v-ge="['rows','delete']"
                  small
                  color="error"
                  @click="deleteRow('showDialog',index ,item)"
                >
                  mdi-delete-forever
                </x-icon>
              </template>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>
    <dlgLabelSubmitCancel
      v-if="rowDeleteDlg"
      type="primary"
      :dialog-show="rowDeleteDlg"
      :actions-mtd="deleteRow"
      heading="Click Submit to Delete the Row"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import dlgLabelSubmitCancel from '../../utils/dlgLabelSubmitCancel.vue'
import findDataTypeMapping from '../../../helpers/findDataTypeMapping.js'

export default {
  components: {
    dlgLabelSubmitCancel
  },
  data() {
    return {
      rows: [],
      cols: [],
      dataTypes: [],
      rowDeleteDlg: false,
      selectedRowForDelete: null,
      client: null,
      primaryKeys: [],
      test: 'null',
      totalCount: 0,
      tableOptions: {},
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
          await this.saveChanges()
          break
        case 'true_l' :
          await this.refreshTable()
          break
        case 'true_n' :
          this.addNewRow()
          break
        // case 'true_d' :
        //   await this.deleteTable('showDialog');
        //   break;
      }
    },

    async refreshTable() {
      try {
        await this.loadColumnList()
        await this.loadRowList()
      } catch (e) {
        this.$toast.error('error loading rows').goAway(4000)
        throw e
      }
    },
    async loadColumnList() {
      // const columnsList = await this.client.columnList({tn: this.nodes.table_name});

      // const columnsList = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'columnList', {tn: this.nodes.table_name})

      const columnsList = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', { tn: this.nodes.table_name || this.nodes.view_name }])

      this.cols = columnsList.data.list.map(({ cn, dt, ai, pk }) => {
        if (pk) { this.primaryKeys.push(cn) }
        return {
          text: cn, value: cn, type: findDataTypeMapping(dt), ai
        }
      })
      // column for action buttons
      if (!this.isView) { this.cols.push({ text: '', value: '' }) }
    },
    async loadRowList() {
      const { page, itemsPerPage } = this.tableOptions

      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'list', {
      //   tn: this.nodes.table_name,
      //   size: itemsPerPage,
      //   page,
      //   orderBy: this.primaryKeys.map(key => ({column: key, order: 'desc'}))
      // })

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'list', {
        tn: this.nodes.table_name || this.nodes.view_name,
        size: itemsPerPage,
        page,
        orderBy: this.primaryKeys.map(key => ({ column: key, order: 'desc' }))
      }])

      // const result = await this.client.list({
      //   tn: this.nodes.table_name,
      //   size: itemsPerPage,
      //   page,
      //   orderBy: this.primaryKeys.map(key => ({column: key, order: 'desc'}))
      // });

      this.totalCount = result.data.count

      this.rows = result.data.list.map((row) => {
        const keys = this.primaryKeys.reduce((obj, key) => Object.assign(obj, { [key]: row[key] }), {})
        return { keys, data: { ...row }, dataCopy: { ...row } }
      })
    },
    save(type, text, item) {
      // console.log(type, text, item)
      item.changed = true
      const { data, dataCopy } = item
      if (type === 'date') {
        dataCopy[text] = new Date(data[text])
      } else {
        dataCopy[text] = data[text]
      }
    },
    getType(dt) {
      if (dt === 'number') { return 'number' }
      return 'text'
    },
    async deleteRow(action = '', index, row) {
      try {
        if (action === 'showDialog') {
          this.rowDeleteDlg = true
          this.selectedRowForDelete = { index, row }
        } else if (action === 'hideDialog') {
          this.rowDeleteDlg = false
        } else {
          this.rowDeleteDlg = false
          const { index, row } = this.selectedRowForDelete
          if (row.isNewRow) {
            this.rows.splice(index, 1)
          } else {
            // this.client.delete(this.nodes.table_name, row.keys)

            await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            }, 'delete', {
              tn: this.nodes.table_name || this.nodes.view_name,
              whereConditions: row.keys
            }])
            this.rows.splice(index, 1)
          }
          this.$toast.success('Row deleted successfully').goAway(3000)
        }
        this.totalCount--
      } catch (e) {
        this.$toast.error('Deleting row failed').goAway(3000)
        throw e
      }
    },
    addNewRow() {
      this.rows.unshift({ isNewRow: true, data: {}, dataCopy: {} })
      this.totalCount++
    },
    async saveChanges() {
      try {
        const newRows = []
        this.rows.map(async(item) => {
          const { keys, isNewRow, changed, dataCopy } = item
          if (isNewRow) {
            newRows.push(dataCopy)
          } else if (changed) {
            item.changed = false
            // const res = await this.client.update(this.nodes.table_name, dataCopy, keys);

            const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            }, 'update', {
              tn: this.nodes.table_name,
              data: dataCopy,
              whereConditions: keys
            }])

            console.log(res)
            this.$toast.success('Row updated successfully').goAway(3000)
          }
        })
        if (newRows.length) {
          console.log(newRows)
          // todo : multiargs to single object
          // const res = await this.client.insert(this.nodes.table_name, newRows)

          const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, 'insert', {
            tn: this.nodes.table_name,
            data: newRows
          }])

          console.log(res)
        }
        this.$toast.success('Row saved successfully').goAway(3000)
        this.loadRowList()
      } catch (e) {
        console.log(e)
        this.$toast.error('Saving changes to table failed').goAway(3000)
        throw e
      }
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }),
    isView() {
      return !!this.nodes.view_name
    }
  },
  beforeCreated() {
  },
  watch: {
    tableOptions: {
      handler() {
        this.loadRowList()
      },
      deep: true
    },
    rows: {
      handler() {
        this.disableSaveButton = !this.rows.some(row => row.isNewRow || row.changed)
      },
      deep: true
    }
  },
  async created() {
    await this.refreshTable()
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
