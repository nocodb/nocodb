<template>
  <v-container fluid class="pa-0 ma-0" style="height: 100%">

    <v-overlay absolute v-if="isMetaTable">
      <v-alert type="info">Meta tables are not editable</v-alert>
    </v-overlay>

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
          text: this.nodes._tn + ' (table)',
          disabled: true,
          href: '#'
        }]" divider=">" small>
          <template v-slot:divider>
            <v-icon small color="grey lighten-2">forward</v-icon>
          </template>
        </v-breadcrumbs>

      </v-toolbar-title>
      <v-spacer></v-spacer>

      <x-btn outlined tooltip="Reload Indexes"
             small
             @click="mtdRefreshIndexList"
             color="primary"
             class="primary"
             v-ge="['indexes','reload']"
      >
        <v-icon small left>refresh</v-icon>
        Reload
      </x-btn>
      <x-btn outlined tooltip="Add New Index"
             icon="mdi-plus"
             small
             @click="mtdAddIndex"
             color="primary"
             class="primary"
             v-if="indexCreationAllowed"
             v-ge="['indexes','new']"
      >
        New Index
      </x-btn>
      <x-btn outlined tooltip="Delete Table"
             small
             @click="deleteTable('showDialog')"
             color="error "
             class="error text-right"
             v-ge="['indexes','delete-table']"
      >
        <v-icon small>mdi-delete-outline</v-icon>&nbsp;Delete Table
      </x-btn>
      <!--      <x-btn outlined tooltip=""-->
      <!--        icon-->
      <!--        class="text-right">-->
      <!--        <v-icon>mdi-help-circle-outline</v-icon>-->
      <!--      </x-btn>-->

    </v-toolbar>

    <!--    <v-row class="pa-0 ma-0">-->
    <!--      <v-col class="pr-0 ma-0" cols="8">-->


    <splitpanes style="height:calc(100% - 42px);" class="xc-theme">
      <pane min-size="33" size="66" style="overflow: auto">
        <v-card class="elevation-0" style="">
          <v-card-title class="headline justify-center">Indexes</v-card-title>
          <v-col>

            <v-skeleton-loader type="table" v-if="loading"></v-skeleton-loader>

            <v-data-table
              v-else
              dense
              :headers="indexHeaders"
              :items="aggregatedIndexes"
              footer-props.items-per-page-options="30">
              <template v-slot:item="props">
                <tr>
                  <td>
                    <v-radio-group
                      v-model="selected"
                      name="rowSelector"
                      dense
                      @change="mtdSelectColumnsForIndex(props.item, props.index)"
                      v-ge="['indexes','radio']"
                    >
                      <v-radio :value="props.index" color="primary"/>
                    </v-radio-group>
                  </td>
                  <td>
                    <v-edit-dialog
                      @save="save(props.item)"
                      @cancel="cancel"
                      @open="open"
                      @close="close(props.item)"
                      v-ge="['indexes','name']"
                    >
                      {{ props.item.key_name }}
                      <template v-slot:input>
                        <v-text-field
                          :disabled="props.index !== selected"
                          class="body-2"
                          v-model="props.item.key_name"
                          :rules="[max25chars]"
                          label="Edit"
                          single-line
                          counter
                        ></v-text-field>
                      </template>
                    </v-edit-dialog>
                  </td>
                  <td>
                    <v-checkbox
                      :disabled="props.index !== selected"
                      dense
                      color="primary lighten-1"
                      v-model="props.item.non_unique"
                      @change="mtdToggleNonUniqueStatus(props.item)"
                      :true-value="0"
                      :false-value="1"
                      v-ge="['indexes','unique']"
                    ></v-checkbox>
                  </td>
                  <td>
                    <v-hover v-slot:default="{ hover }">
                      <v-icon
                        v-ge="['indexes','delete']"
                        small
                        :color="hover ? 'error' : 'grey'"
                        @click="
                        mtdIndexDelete('showDialog', props.item, props.index)
                      ">mdi-delete
                      </v-icon>
                    </v-hover>
                    <x-btn outlined tooltip="Index Create"
                           v-ge="['indexes','create']"
                           @click="mtdIndexCreate(props.item)"
                           color="primary"
                           small
                           v-if="props.item.edited && props.index === selected">
                      <v-icon small>mdi-content-save</v-icon>&nbsp;Save
                    </x-btn
                    >
                  </td>
                </tr>
              </template>
            </v-data-table>
          </v-col>
        </v-card>
      </pane>
      <pane min-size="25" size="33" style="overflow: auto">

        <v-card class="elevation-0" style="">
          <v-card-title class="headline justify-center">Columns in Index</v-card-title>
          <v-col>
            <v-skeleton-loader type="table" v-if="columnLoading"></v-skeleton-loader>
            <v-data-table
              v-else
              dense
              :headers="columnHeaders"
              :items="indexColumns"
              footer-props.items-per-page-options="30"
            >
              <template v-slot:item="props">
                <tr>
                  <td>
                    <v-checkbox
                      v-ge="['indexes','toggle-order']"
                      dense
                      color="primary lighten-1"
                      v-model="props.item.is_index"
                      @change="mtdToggleColumnInIndex(props.item, props.index)"
                    ></v-checkbox>
                  </td>
                  <td>{{ props.item.cn }}</td>
                  <td>{{ props.item.seq_in_index }}</td>
                </tr>
              </template>
            </v-data-table>
          </v-col>
        </v-card>
      </pane>
    </splitpanes>
    <dlgLabelSubmitCancel
      type="error"
      v-if="showIndexDeleteDialog"
      :dialogShow="showIndexDeleteDialog"
      :actionsMtd="mtdIndexDelete"
      heading="Click Submit to Delete the Index"
    />
  </v-container>
</template>

<script>
import {mapGetters, mapActions} from "vuex";
import dlgLabelSubmitCancel from "../../utils/dlgLabelSubmitCancel";
import {Splitpanes, Pane} from 'splitpanes'

export default {
  components: {dlgLabelSubmitCancel, Splitpanes, Pane},
  data() {
    return {
      selected: [],
      indexCreationAllowed: true,
      applyChanges: true,

      columns: [],
      aggregatedIndexes: [],
      indexes: [],
      indexColumns: [],


      indexHeaders: [
        {
          text: "#",
          sortable: false
        },
        {
          text: "Index",
          sortable: false
        },
        {
          text: "Unique",
          sortable: false
        },
        {
          text: "Actions",
          sortable: false
        }
      ],
      columnHeaders: [
        {
          text: "#",
          sortable: false
        },
        {
          text: "Column",
          sortable: false
        },
        {
          text: "Sequence",
          sortable: false
        }
      ],
      max25chars: v => v.length <= 25 || "Input too long!",
      showIndexDeleteDialog: false,
      selectedIndexForDelete: null,
      columnLoading: false,
      loading: false
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
        // case 'true_s' :
        //   await this.applyChanges();
        //   break;
        case 'true_l' :
          await this.mtdRefreshIndexList();
          break;
        case 'true_n' :
          this.addIndex();
          break;
        case 'true_d' :
          await this.deleteTable('showDialog');
          break;

      }
    },

    async mtdRefreshIndexList() {

      try {
        this.$store.commit('notification/MutToggleProgressBar', true);
        if (this.newTable) {
          return;
        }
        await this.getColumnList();
        await this.getIndexesAndCreateAggregatedIndexes();
        this.mtdSelectColumnsForIndex();
        this.calculateColumnSequenceValue();

      } catch (e) {
        console.log(e);
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false);
      }

    },
    getColumnsForIndexCreation(columns) {
      /*************** START : get columns in this index ***************/
      let tempIndexes = JSON.parse(JSON.stringify(columns));
      console.log("columns in index", columns);
      tempIndexes = tempIndexes.filter(function (a) {
        return a.seq_in_index !== 0;
      });

      console.log("tempIndexes after filter", tempIndexes);

      tempIndexes = tempIndexes.sort(function (a, b) {
        return a.seq_in_index - b.seq_in_index;
      });
      console.log("tempIndexes after sort", tempIndexes);

      let cols = [];

      for (let i = 0; i < tempIndexes.length; i++) {
        cols.push(tempIndexes[i].cn);
      }

      return cols;

      /*************** END : get columns in this index ***************/
    },
    async mtdIndexCreate(aggregatedIndex) {
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      console.log(aggregatedIndex);

      if (aggregatedIndex.added) {
        let cols = this.getColumnsForIndexCreation(aggregatedIndex.columns);
        if (!cols.length) {
          return;
        }

        let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          "indexCreate",
          {
            tn: this.nodes.tn,
            columns: cols,
            indexName: aggregatedIndex.key_name,
            non_unique: aggregatedIndex.non_unique
          }]);

      } else {
        console.log(
          "IndexCreation involves dropping existing index and creating new one"
        );
        let colsToRemove = this.getColumnsForIndexCreation(
          aggregatedIndex.oldColumns
        );
        if (!aggregatedIndex.editedIndexAttr && !colsToRemove.length) {
          return;
        }
        console.log("indexDelete for :", colsToRemove);

        // let result = await this.sqlMgr.sqlOpPlus(
        //   {
        //     env: this.nodes.env,
        //     dbAlias: this.nodes.dbAlias
        //   },
        //   "indexDelete",
        //   {
        //     tn: this.nodes.tn,
        //     columns: colsToRemove,
        //     indexName: aggregatedIndex.key_name,
        //     non_unique: aggregatedIndex.non_unique
        //   }
        // );

        let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          "indexDelete",
          {
            tn: this.nodes.tn,
            columns: colsToRemove,
            indexName: aggregatedIndex.key_name,
            non_unique: aggregatedIndex.non_unique,
            non_unique_original: aggregatedIndex.non_unique_original
          }]);


        let colsToCreate = this.getColumnsForIndexCreation(
          aggregatedIndex.columns
        );
        if (!colsToCreate.length) {
          return;
        }
        console.log("indexCreate for :", colsToCreate);

        // result = await this.sqlMgr.sqlOpPlus(
        //   {
        //     env: this.nodes.env,
        //     dbAlias: this.nodes.dbAlias
        //   },
        //   "indexCreate",
        //   {
        //     tn: this.nodes.tn,
        //     columns: colsToCreate,
        //     indexName: aggregatedIndex.key_name,
        //     non_unique: aggregatedIndex.non_unique
        //   }
        // );

        result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          "indexCreate",
          {
            tn: this.nodes.tn,
            columns: colsToCreate,
            indexName: aggregatedIndex.key_name,
            non_unique: aggregatedIndex.non_unique
          }]);

      }

      await this.mtdRefreshIndexList();
    },
    async mtdIndexDelete(action = "", aggregatedIndex, index) {
      if (action === "showDialog") {
        this.showIndexDeleteDialog = true;
        this.selectedIndexForDelete = {aggregatedIndex, index};
      } else if (action === "hideDialog") {
        this.showIndexDeleteDialog = false;
        this.selectedIndexForDelete = null;
      } else {
        if (this.selectedIndexForDelete.aggregatedIndex.added === 1) {
          this.aggregatedIndexes.splice(this.selectedIndexForDelete.index, 1);
          console.log(
            "This was newly added index : deletign without going to lib"
          );
        } else {
          // const client = await this.sqlMgr.projectGetSqlClient({
          //   env: this.nodes.env,
          //   dbAlias: this.nodes.dbAlias
          // });

          /*************** START : get columns in this index ***************/
          let tempIndexes = JSON.parse(
            JSON.stringify(this.selectedIndexForDelete.aggregatedIndex.columns)
          );

          tempIndexes = tempIndexes.filter(function (a) {
            return a.seq_in_index !== 0;
          });

          console.log("tempIndexes after filter", tempIndexes);

          tempIndexes = tempIndexes.sort(function (a, b) {
            return a.seq_in_index - b.seq_in_index;
          });
          console.log("tempIndexes after sort", tempIndexes);

          let cols = [];

          for (let i = 0; i < tempIndexes.length; i++) {
            cols.push(tempIndexes[i].cn);
          }
          /*************** END : get columns in this index ***************/

            // const result = await client.indexDelete({
            //   tn: this.nodes.tn,
            //   columns: cols,
            //   indexName: this.selectedIndexForDelete.aggregatedIndex.key_name
            // });

            // let result = await this.sqlMgr.sqlOpPlus(
            //   {
            //     env: this.nodes.env,
            //     dbAlias: this.nodes.dbAlias
            //   },
            //   "indexDelete",
            //   {
            //     tn: this.nodes.tn,
            //     columns: cols,
            //     indexName: this.selectedIndexForDelete.aggregatedIndex.key_name,
            //     non_unique: this.selectedIndexForDelete.aggregatedIndex.non_unique
            //   }
            // );

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
              {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias
              },
              "indexDelete",
              {
                tn: this.nodes.tn,
                columns: cols,
                indexName: this.selectedIndexForDelete.aggregatedIndex.key_name,
                non_unique: this.selectedIndexForDelete.aggregatedIndex.non_unique,
                non_unique_original: this.selectedIndexForDelete.aggregatedIndex.non_unique_original
              }]);


          await this.mtdRefreshIndexList();
        }
        this.showIndexDeleteDialog = false;
        this.selectedIndexForDelete = null;
      }
    },
    mtdToggleNonUniqueStatus(aggregatedIndex) {
      console.log('mtdToggleNonUniqueStatus', aggregatedIndex);
      //aggregatedIndex.non_unique = aggregatedIndex.non_unique ? 0 : 1;
      aggregatedIndex.edited = true;
      aggregatedIndex.editedIndexAttr = true;

    },
    mtdToggleColumnInIndex(cn, index) {
      console.log("Index being edited:", this.selected);

      let aggregatedIndex = this.aggregatedIndexes.find(
        (o, i) => i === this.selected
      );

      console.log("aggregatedIndex on toggle of column", aggregatedIndex);

      if (aggregatedIndex.added) {
        console.log("This was newly added index");
      } else {
        console.log("This is an existing index");
        aggregatedIndex.edited = true;
        if (!aggregatedIndex.oldColumns.length) {
          console.log("Taking backup of old columns");
          aggregatedIndex.oldColumns = JSON.parse(
            JSON.stringify(aggregatedIndex.columns)
          );
        } else {
          console.log(
            "Taking backup of old columns : old columns already exists"
          );
        }
      }

      if (cn.seq_in_index) {
        for (let i = 0; i < this.indexColumns.length; i++) {
          if (this.indexColumns[i].seq_in_index > cn.seq_in_index) {
            this.indexColumns[i].seq_in_index -= 1;
          }
        }
        cn.seq_in_index = 0;
      } else {
        const max = Math.max.apply(
          Math,
          this.indexColumns.map(function (o) {
            return o.seq_in_index;
          })
        );
        console.log("max value:", max);
        cn.seq_in_index = max + 1;
      }
    },
    mtdAddIndex() {
      const itemIndex = this.aggregatedIndexes.length;
      let index = {
        cardinality: "a",
        collation: "a",
        cn: "",
        comment: "",
        expression: "",
        index_comment: "",
        index_type: "BTREE",
        key_name: "idx_" + itemIndex,
        non_unique: 1,
        null: "",
        packed: "",
        seq_in_index: 0,
        sub_part: "",
        table: "",
        visible: "",
        added: 1,
        edited: 1,
        columns: JSON.parse(JSON.stringify(this.columns))
      };
      this.aggregatedIndexes.push(index);
      this.selected = itemIndex;
      this.mtdSelectColumnsForIndex(index, itemIndex)
    },
    mtdResetColumnsIndexes() {
      for (let j = 0; j < this.columns.length; j++) {
        this.columns[j].seq_in_index = 0;
        this.columns[j].is_index = false;
      }
    },
    mtdSelectColumnsForIndex(indexObj = null, index = 0) {

      console.log('selecting index', index);

      if (!indexObj) {
        if (this.aggregatedIndexes.length) {
          indexObj = this.aggregatedIndexes[0];
          this.selected = index
          // this.$nextTick(() => {
          //   this.selected = indexObj.key_name + ''
          // })
        }
      }
      //
      //
      // for (let i = 0; i < this.indexes.length; i++) {
      //   if (indexObj.key_name === this.indexes[i].key_name) {
      //     console.log(indexObj.key_name, this.indexes[i].key_name);
      //     for (let j = 0; j < this.columns.length; j++) {
      //       if (this.indexes[i].cn === this.columns[j].cn) {
      //         indexObj.columns[j].seq_in_index = this.indexes[i].seq_in_index;
      //         indexObj.columns[j].is_index = true;
      //         console.log("Column is in index: ", this.columns[j]);
      //       }
      //     }
      //   }
      // }

      this.indexColumns = indexObj.columns;
    },
    calculateColumnSequenceValue() {
      this.aggregatedIndexes.forEach(indexObj => {
        for (let i = 0; i < this.indexes.length; i++) {
          if (indexObj.key_name === this.indexes[i].key_name) {
            console.log(indexObj.key_name, this.indexes[i].key_name);
            for (let j = 0; j < this.columns.length; j++) {
              if (this.indexes[i].cn === this.columns[j].cn) {
                indexObj.columns[j].seq_in_index = this.indexes[i].seq_in_index;
                indexObj.columns[j].is_index = true;
                console.log("Column is in index: ", this.columns[j]);
              }
            }
          }
        }
      })
    },

    createAggregatedIndexesList(indexes) {
      for (let i = 0; i < indexes.length; i++) {
        const index = {...indexes[i]};
        let found = 0;
        for (let j = 0; j < this.aggregatedIndexes.length; j++) {
          const aggregatedIndex = this.aggregatedIndexes[j];

          if (aggregatedIndex.key_name === index.key_name) {
            found = 1;
            break;
          }
        }
        if (!found) {
          index.edited = false;
          index.columns = [];
          index.oldColumns = [];
          index.columns = JSON.parse(JSON.stringify(this.columns));
          this.aggregatedIndexes.push(index);
        }


      }

    },
    async getIndexesAndCreateAggregatedIndexes() {
      this.loading = true;

      if (this.newTable) return;

      this.indexes = [];
      this.aggregatedIndexes = [];

      // console.log("env: this.nodes.env", this.nodes.env, this.nodes.dbAlias);
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.indexList({
      //   tn: this.nodes.tn
      // });
      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'indexList', {
      //   tn: this.nodes.tn
      // })

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'indexList', {
        tn: this.nodes.tn
      }])


      this.createAggregatedIndexesList(result.data.list);

      // this.indexes = JSON.parse(JSON.stringify(result.data.list));
      this.indexes = [];
      this.indexes = result.data.list;
      console.log('Indexes List in table', this.indexes);
      console.log('Aggregated Indexes in table', this.aggregatedIndexes);

      this.loading = false;
    },
    async getColumnList() {
      this.columnLoading = true;
      // console.log("env: this.nodes.env", this.nodes.env, this.nodes.dbAlias);
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.columnList({
      //   tn: this.nodes.tn
      // });

      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'columnList', {
      //   tn: this.nodes.tn
      // })

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', {
        tn: this.nodes.tn
      }])

      this.columns = JSON.parse(JSON.stringify(result.data.list));
      for (let i = 0; i < this.columns.length; i++) {
        this.columns[i]["seq_in_index"] = 0;
        this.columns[i]["is_index"] = false;
      }

      console.log("Columns in table:", this.columns);
      this.columnLoading = false;
    },
    save(aggregatedIndex) {

      aggregatedIndex.edited = true;

      this.snack = true;
      this.snackColor = "success";
      this.snackText = "Data saved";


    },
    cancel() {
      this.snack = true;
      this.snackColor = "error";
      this.snackText = "Canceled";
      console.log("Dialog Canceled");
    },
    open() {
      this.snack = true;
      this.snackColor = "info";
      this.snackText = "Dialog opened";
    },
    close(aggregatedIndex) {
      aggregatedIndex.edited = true;
    }
  },
  computed: {
    ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"})
  },

  beforeCreated() {
  },
  async created() {
    await this.mtdRefreshIndexList();
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
  props: ["nodes", "newTable", "deleteTable", 'isMetaTable'],
  watch: {
    columns: function () {
      return this.columns;
    },
    aggregatedIndexes(v, ov) {
      console.log(v, ov);
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
