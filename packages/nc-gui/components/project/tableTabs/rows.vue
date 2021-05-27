<template>
  <div class="">
    <v-card class="elevation-0">

      <v-toolbar flat height="42" class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },{
          text: this.nodes.dbAlias,
          disabled: true,
          href: '#'
        },
        {
          text: (nodes.tn || nodes.view_name) + ' (rows)',
          disabled: true,
          href: '#'
        }]" divider=">" small>
            <template v-slot:divider>
              <v-icon small color="grey lighten-2">forward</v-icon>
            </template>
          </v-breadcrumbs>

        </v-toolbar-title>
        <v-spacer></v-spacer>
        <x-btn outlined tooltip="Reload Rows"
               color="primary"
               small
               v-ge="['rows','reload']"
               @click="refreshTable">
          <v-icon small left>refresh</v-icon>
          Reload
        </x-btn>
        <x-btn outlined tooltip="Save Changes"
               color="primary"
               class="primary"
               small
               v-if="!isView"
               :disabled="disableSaveButton"
               v-ge="['rows','save']"
               @click.prevent="saveChanges">
          <v-icon small left>save</v-icon>
          Save
        </x-btn>
        <x-btn outlined tooltip="Add New Row"
               color="primary"
               class="primary"
               small
               v-if="!isView"
               v-ge="['rows','new']"
               @click="addNewRow">
          <v-icon small left>mdi-plus</v-icon>
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

        <template v-slot:header="{props:{headers}}">
          <th class="py-2 px-1 text-center text-capitalize" v-for="header in headers" :key="header.title">
            {{ header.text }}
          </th>
        </template>


        <template v-slot:item="{item,index}">
          <tr v-if="!item.isNewRow">
            <td v-for="({text,type,ai:ai},i) in cols" :key="i" class="caption">
              <span v-if="isView">
                  {{ item.data[text] }}
              </span>
              <template v-else-if="text">
                <v-edit-dialog

                  :return-value.sync="item.data[text]"
                  @save="save(type,text,item)"
                  v-ge="['rows','edit-save']"
                >
                  {{ item.data[text] }}
                  <template v-slot:input>
                    <v-text-field
                      class="mt-0 caption"
                      v-model="item.data[text]"
                      label="Edit"
                      :type="getType(type)"
                      single-line
                      hide-details
                      dense
                      :disabled="ai"
                    ></v-text-field>
                  </template>
                </v-edit-dialog>
              </template>
              <template v-else>
                <x-icon small
                        color="error grey"
                        @click="deleteRow('showDialog', index, item)"
                        v-ge="['rows','delete']"
                >mdi-delete-forever
                </x-icon
                >
              </template>
            </td>

          </tr>
          <tr v-else>
            <td v-for="({text,type,ai:ai},i) in cols" :key="i">
              <template v-if="text">
                <v-text-field
                  dense
                  hide-details
                  @input.passive="save(type,text,item)"
                  v-model="item.data[text]"
                  label="Edit"
                  :type="getType(type)"
                  :placeholder="text"
                  :disabled="ai"
                  single-line
                  v-ge="['rows','save']"
                  class="caption mt-n1 "
                ></v-text-field>
              </template>
              <template v-else>
                <x-icon small
                        color="error"
                        @click="deleteRow('showDialog',index ,item)"
                        v-ge="['rows','delete']"
                >mdi-delete-forever
                </x-icon
                >
              </template>
            </td>
          </tr>

        </template>
      </v-data-table>

    </v-card>
    <dlgLabelSubmitCancel
      type="primary"
      v-if="rowDeleteDlg"
      :dialogShow="rowDeleteDlg"
      :actionsMtd="deleteRow"
      heading="Click Submit to Delete the Row"
    />
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import dlgLabelSubmitCancel from "../../utils/dlgLabelSubmitCancel.vue";
import findDataTypeMapping from '../../../helpers/findDataTypeMapping.js';

export default {
  components: {
    dlgLabelSubmitCancel: dlgLabelSubmitCancel
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
    };
  },
  methods: {
    async handleKeyDown({metaKey, key, altKey, shiftKey, ctrlKey}) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        case 'true_s' :
          await this.saveChanges();
          break;
        case 'true_l' :
          await this.refreshTable();
          break;
        case 'true_n' :
          this.addNewRow();
          break;
        // case 'true_d' :
        //   await this.deleteTable('showDialog');
        //   break;

      }
    },

    async refreshTable() {
      try {
        await this.loadColumnList();
        await this.loadRowList();
      } catch (e) {
        this.$toast.error('error loading rows').goAway(4000);
        throw e;
      }
    },
    async loadColumnList() {
      // const columnsList = await this.client.columnList({tn: this.nodes.tn});


      // const columnsList = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'columnList', {tn: this.nodes.tn})


      const columnsList = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', {tn: this.nodes.tn || this.nodes.view_name}])


      this.cols = columnsList.data.list.map(({cn, dt, ai, pk}) => {
        if (pk) this.primaryKeys.push(cn);
        return {
          text: cn, value: cn, type: findDataTypeMapping(dt), ai
        }
      })
      // column for action buttons
      if (!this.isView)
        this.cols.push({text: '', value: ''})
    },
    async loadRowList() {

      const {page, itemsPerPage} = this.tableOptions;

      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'list', {
      //   tn: this.nodes.tn,
      //   size: itemsPerPage,
      //   page,
      //   orderBy: this.primaryKeys.map(key => ({column: key, order: 'desc'}))
      // })


      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'list', {
        tn: this.nodes.tn || this.nodes.view_name,
        size: itemsPerPage,
        page,
        orderBy: this.primaryKeys.map(key => ({column: key, order: 'desc'}))
      }])


      // const result = await this.client.list({
      //   tn: this.nodes.tn,
      //   size: itemsPerPage,
      //   page,
      //   orderBy: this.primaryKeys.map(key => ({column: key, order: 'desc'}))
      // });

      this.totalCount = result.data.count;

      this.rows = result.data.list.map(row => {
        const keys = this.primaryKeys.reduce((obj, key) => Object.assign(obj, {[key]: row[key]}), {})
        return {keys, data: {...row}, dataCopy: {...row}};
      });
    },
    save(type, text, item) {
      // console.log(type, text, item)
      item.changed = true;
      const {data, dataCopy} = item;
      if (type === 'date') {
        dataCopy[text] = new Date(data[text]);
      } else {
        dataCopy[text] = data[text];
      }
    },
    getType(dt) {
      if (dt == 'number')
        return 'number';
      return 'text'
    },
    async deleteRow(action = "", index, row) {
      try {
        if (action === "showDialog") {
          this.rowDeleteDlg = true;
          this.selectedRowForDelete = {index, row};
        } else if (action === "hideDialog") {
          this.rowDeleteDlg = false;
        } else {
          this.rowDeleteDlg = false;
          const {index, row} = this.selectedRowForDelete;
          if (row.isNewRow) {
            this.rows.splice(index, 1);
          } else {
            // this.client.delete(this.nodes.tn, row.keys)


            await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            }, 'delete', {
              tn: this.nodes.tn || this.nodes.view_name,
              whereConditions: row.keys
            }])


            // await this.sqlMgr.sqlOp({
            //   env: this.nodes.env,
            //   dbAlias: this.nodes.dbAlias
            // }, 'delete', {
            //   tn: this.nodes.tn,
            //   whereConditions: row.keys
            // });


            this.rows.splice(index, 1);
          }
          this.$toast.success('Row deleted successfully').goAway(3000);
        }
        this.totalCount--;
      } catch (e) {
        this.$toast.error('Deleting row failed').goAway(3000);
        throw e;
      }

    },
    addNewRow() {
      this.rows.unshift({isNewRow: true, data: {}, dataCopy: {}})
      this.totalCount++;
    },
    async saveChanges() {
      try {
        const newRows = [];
        this.rows.map(async item => {
          const {keys, isNewRow, changed, dataCopy} = item;
          if (isNewRow) {
            newRows.push(dataCopy);
          } else if (changed) {
            item.changed = false;
            // const res = await this.client.update(this.nodes.tn, dataCopy, keys);

            const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            }, 'update', {
              tn: this.nodes.tn,
              data: dataCopy,
              whereConditions: keys
            }]);

            console.log(res);
            this.$toast.success('Row updated successfully').goAway(3000);
          }
        });
        if (newRows.length) {
          console.log(newRows);
          // todo : multiargs to single object
          // const res = await this.client.insert(this.nodes.tn, newRows)


          const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, 'insert', {
            tn: this.nodes.tn,
            data: newRows
          }]);


          console.log(res)
        }
        this.$toast.success('Row saved successfully').goAway(3000);
        this.loadRowList()
      } catch (e) {
        console.log(e);
        this.$toast.error('Saving changes to table failed').goAway(3000);
        throw e;
      }

    }
  },
  computed: {
    ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"}),
    isView() {
      return !!this.nodes.view_name
    }
  },
  beforeCreated() {
  },
  async created() {
    await this.refreshTable();
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  validate({params}) {
    return true;
  },
  head() {
    return {};
  },
  props: ["nodes", "newTable", "mtdNewTableUpdate", "deleteTable"],
  watch: {
    tableOptions: {
      handler() {
        this.loadRowList();
      },
      deep: true,
    },
    rows: {
      handler() {
        this.disableSaveButton = !this.rows.some(row => row.isNewRow || row.changed)
      },
      deep: true
    }
  },
  directives: {}
};
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
