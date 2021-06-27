<template>
  <v-container class="h-100 j-excel-container pa-0 ma-0" fluid>
    <v-toolbar height="32" dense class="elevation-0 xc-toolbar xc-border-bottom" style="z-index: 7">

      <div class="d-flex xc-border align-center search-box">

        <v-menu bottom offset-y>
          <template v-slot:activator="{on}">
            <div v-on="on">
              <v-icon class="pa-1 pr-0 ml-2" small
                      color="grey"
              >mdi-magnify
              </v-icon>

              <v-icon color="grey"
                      class="pl-0 pa-1" small>mdi-menu-down
              </v-icon>
            </div>
          </template>
          <v-list dense>
            <v-list-item v-for="col in availableColumns" :key="col.cn"
                         @click="searchField = col._cn">
              <span class="caption">{{ col._cn }}</span>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-divider
          vertical></v-divider>

        <v-text-field
          autocomplete="off"
          v-model="searchQueryVal"
          style="min-width: 300px"
          flat
          dense
          solo
          hide-details
          @keyup.enter="searchQuery = searchQueryVal"
          @blur="searchQuery = searchQueryVal"
          :placeholder="searchField ? `Search '${searchField}' column` : 'Search all columns'"
          class="elevation-0 pa-0 flex-grow-1 caption search-field">


        </v-text-field>
      </div>


      <span v-if="relationType && false"
            class="caption grey--text">{{ refTable }}({{
          relationPrimaryValue
        }}) -> {{ relationType === 'hm' ? ' Has Many ' : ' Belongs To ' }} -> {{ table }}</span>


      <v-spacer></v-spacer>
      <lock-menu v-if="_isUIAllowed('view-type')" v-model="viewStatus.type"></lock-menu>
      <x-btn tooltip="Reload view data" outlined small text @click="loadTableData">
        <v-icon small class="mr-1" color="grey  darken-3">mdi-reload</v-icon>
      </x-btn>
      <x-btn tooltip="Add new row" v-if="relationType !== 'bt'" :disabled="isLocked" outlined small text
             @click="insertNewRow(true,true)">
        <v-icon small class="mr-1" color="grey  darken-3">mdi-plus</v-icon>
      </x-btn>
      <x-btn small text outlined tooltip="Save new rows" :disabled="!edited || isLocked" @click="save">
        <v-icon small class="mr-1" color="grey  darken-3">save</v-icon>
        Save
      </x-btn>


      <fields
        v-model="showFields"
        :field-list="fieldList"
        :meta="meta"
        :is-locked="isLocked"
        :fieldsOrder.sync="fieldsOrder"
        :sqlUi="sqlUi"
        :showSystemFields.sync="showSystemFields"
      />

      <sort-list
        :is-locked="isLocked"
        :field-list="fieldList"
        v-model="sortList"
      ></sort-list>
      <column-filter
        :is-locked="isLocked"
        :field-list="fieldList"
        v-model="filters"
        dense>
      </column-filter>
      <v-tooltip bottom>
        <template v-slot:activator="{on}">
          <v-btn :disabled="isLocked" v-on="on" small @click="deleteTable('showDialog')" outlined text>
            <x-icon small color="red grey">mdi-delete-outline</x-icon>
          </v-btn>
        </template>
        <span class="">Delete table</span>
      </v-tooltip>
      <!-- Cell height -->
      <!--      <v-menu>
              <template v-slot:activator="{ on, attrs }">
                <v-icon
                  v-bind="attrs"
                  v-on="on" small
                  class="mx-2"
                  color="grey  darken-3"
                >
                  mdi-arrow-collapse-vertical
                </v-icon>
              </template>

              <v-list dense class="caption">

                <v-list-item v-for="h in cellHeights" dense @click.stop="cellHeight = h.size" :key="h.size">
                  <v-list-item-icon class="mr-1">
                    <v-icon small :color="cellHeight === h.size && 'primary'">{{ h.icon }}</v-icon>
                  </v-list-item-icon>
                  <v-list-item-title :class="{'primary&#45;&#45;text' : cellHeight === h.size}" style="text-transform: capitalize">
                    {{ h.size }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>-->

      <x-btn
        tooltip="Toggle navigation drawer"
        outlined small text @click="toggleDrawer = !toggleDrawer"
        :btnClass="{ 'primary lighten-5' : !toggleDrawer}"
      >
        <v-icon small
                class="mx-2"
                color="grey  darken-3"
        >{{ toggleDrawer ? 'mdi-door-closed' : 'mdi-door-open' }}
        </v-icon>


      </x-btn>


      <!--      <v-spacer></v-spacer>-->

      <!--      <v-text-field outlined dense hide-details class="elevation-0" append-icon="mdi-magnify"></v-text-field>-->
    </v-toolbar>


    <div :class="`cell-height-${cellHeight}`"
         style=" height:calc(100% - 32px);overflow:auto;transition: width 500ms "
         class="d-flex"
    >
      <div class="flex-grow-1 h-100" style="overflow-y: auto">
        <div ref="table" style="height : calc(100% - 36px); overflow: auto;width:100%">

          <v-skeleton-loader v-if="!dataLoaded && (loadingData || loadingMeta)" type="table"></v-skeleton-loader>
          <template v-else-if="selectedView && (selectedView.type === 'table' || selectedView.show_as === 'grid' )">
            <xc-grid-view
              ref="ncgridview"
              :relationType="relationType"
              :columns-width.sync="columnsWidth"
              :is-locked="isLocked"
              :table="table"
              :availableColumns="availableColumns"
              :showFields="showFields"
              :sqlUi="sqlUi"
              :isEditable="isEditable"
              :nodes="nodes"
              :primaryValueColumn="primaryValueColumn"
              :belongsTo="belongsTo"
              :hasMany="hasMany"
              :data="data"
              :visibleColLength="visibleColLength"
              :meta="meta"
              :isVirtual="selectedView.type === 'vtable'"
              :api="api"
              @onNewColCreation="onNewColCreation"
              @onCellValueChange="onCellValueChange"
              @insertNewRow="insertNewRow"
              @showRowContextMenu="showRowContextMenu"
              @addNewRelationTab="addNewRelationTab"
              @expandRow="expandRow"
              @onRelationDelete="loadMeta"
              @loadTableData="loadTableData"
            ></xc-grid-view>
          </template>
          <template v-else-if="selectedView && selectedView.show_as === 'gallery' ">
            <gallery-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :primaryValueColumn="primaryValueColumn"
              @expandForm="({rowIndex,rowMeta}) => expandRow(rowIndex,rowMeta)"
            ></gallery-view>
          </template>
          <template v-else-if="selectedView && selectedView.show_as === 'kanban' ">
            <kanban-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :primaryValueColumn="primaryValueColumn"
              @expandForm="({rowIndex,rowMeta}) => expandRow(rowIndex,rowMeta)"
            ></kanban-view>
          </template>
          <template v-else-if="selectedView && selectedView.show_as === 'calendar' ">
            <calendar-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :primaryValueColumn="primaryValueColumn"
              @expandForm="({rowIndex,rowMeta}) => expandRow(rowIndex,rowMeta)"
            ></calendar-view>
          </template>

        </div>
        <template v-if="data">
          <pagination
            :count="count"
            :size="size"
            v-model="page"
            @input="loadTableData"
          />
          <!--  <v-pagination
              v-if="count !== Infinity"
              style="max-width: 100%"
              v-model="page"
              :length="Math.ceil(count / size)"
              :total-visible="8"
              @input="loadTableData"
              color="primary lighten-2"
            ></v-pagination>
            <div v-else class="mx-auto d-flex align-center mt-n1 " style="max-width:250px">
              <span class="caption" style="white-space: nowrap"> Change page:</span>
              <v-text-field
                class="ml-1 caption"
                :full-width="false"
                outlined
                dense
                hide-details
                v-model="page"
                @keydown.enter="loadTableData"
                type="number"
              >
                <template #append>
                  <x-icon tooltip="Change page" small icon.class="mt-1" @click="loadTableData">mdi-keyboard-return
                  </x-icon>
                </template>
              </v-text-field>
            </div>-->
        </template>
        <!--      <div v-else class="d-flex justify-center py-4">-->
        <!--        <v-alert type="info" dense class="ma-1 flex-shrink-1">Table is empty</v-alert>-->
        <!--      </div>-->
      </div>

      <spreadsheet-nav-drawer
        :currentApiUrl="currentApiUrl"
        :toggleDrawer="toggleDrawer"
        :nodes="nodes"
        :table="table"
        :meta="meta"
        :selectedViewId.sync="selectedViewId"
        :selectedView.sync="selectedView"
        :primaryValueColumn="primaryValueColumn"
        :concatenatedXWhere="concatenatedXWhere"
        :sort="sort"
        :filters.sync="filters"
        :sortList.sync="sortList"
        :showFields.sync="showFields"
        @mapFieldsAndShowFields="mapFieldsAndShowFields"
        @loadTableData="loadTableData"
        ref="drawer"
        :load="loadViews"
        :hide-views="!relation"
        :showAdvanceOptions.sync="showAdvanceOptions"
        :fieldsOrder.sync="fieldsOrder"
        :viewStatus.sync="viewStatus"
        :columnsWidth.sync="columnsWidth"
        @showAdditionalFeatOverlay="showAdditionalFeatOverlay($event)"
      >
        <v-tooltip bottom>
          <template v-slot:activator="{on}">
            <v-list-item
              v-on="on"
              @click="showAdditionalFeatOverlay('webhooks')">

              <v-icon x-small class="mr-2">mdi-hook</v-icon>
              <span class="caption"> Automations</span>
            </v-list-item>

          </template>
          Create Automations or API Webhooks
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{on}">
            <v-list-item
              v-on="on"
              @click="showAdditionalFeatOverlay('acl')">
              <v-icon x-small class="mr-2">mdi-shield-edit-outline</v-icon>
              <span class="caption"> API ACL</span>
            </v-list-item>
          </template>
          Create / Edit API Webhooks
        </v-tooltip>
        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('validators')">

          <v-icon x-small class="mr-2">mdi-sticker-check-outline</v-icon>
          <span class="caption"> API Validators</span>
        </v-list-item>
        <v-divider
          v-if="showAdvanceOptions" class="advance-menu-divider"></v-divider>

        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('columns')">
          <v-icon x-small class="mr-2">mdi-view-column</v-icon>
          <span class="caption font-weight-light">SQL Columns</span>
        </v-list-item>
        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('indexes')">

          <v-icon x-small class="mr-2">mdi-blur</v-icon>
          <span class="caption font-weight-light">SQL Indexes</span>
        </v-list-item>
        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('triggers')">

          <v-icon x-small class="mr-2">mdi-shield-edit-outline</v-icon>
          <span class="caption font-weight-light">SQL Triggers</span>
        </v-list-item>

      </spreadsheet-nav-drawer>
    </div>


    <v-menu
      v-if="rowContextMenu"
      value="rowContextMenu"
      :position-x="rowContextMenu.x"
      :position-y="rowContextMenu.y"
      absolute
      offset-y
    >
      <v-list dense>
        <template v-if="isEditable && !isLocked">
          <v-list-item
            v-if="relationType !== 'bt'"
            @click="insertNewRow(false)"
          >
            <span class="caption">Insert New Row</span>
          </v-list-item>
          <v-list-item @click="deleteRow">
            <span class="caption">Delete Row</span>
          </v-list-item>
          <v-list-item @click="deleteSelectedRows">
            <span class="caption">Delete Selected Rows</span>
          </v-list-item>

        </template>
        <template v-if="meta.hasMany && meta.hasMany.length">

          <v-divider v-if="isEditable && !isLocked"></v-divider>
          <span class="ml-3 grey--text " style="font-size: 9px">Has Many</span>

          <v-list-item v-for="(hm,i) in meta.hasMany" @click="addNewRelationTabCtxMenu(hm,'hm')" :key="i">
            <span class="caption text-capitalize">{{ hm._tn }}</span>
          </v-list-item>
        </template>

        <template v-if="meta.belongsTo && meta.belongsTo.length">

          <v-divider></v-divider>
          <span class="ml-3 grey--text " style="font-size: 9px">Belongs To</span>

          <v-list-item v-for="(bt,i) in belongsTo" @click="addNewRelationTabCtxMenu(bt,'bt')" :key="i">
            <span class="caption text-capitalize">{{ bt._rtn }}</span>
          </v-list-item>
        </template>


      </v-list>
    </v-menu>
    <v-dialog
      :overlay-opacity="0.8"
      v-if="data"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
      v-model="showExpandModal">

      <expanded-form
        :db-alias="nodes.dbAlias"
        :has-many="hasMany"
        :belongs-to="belongsTo"
        v-if="selectedExpandRowIndex != null && data[selectedExpandRowIndex]"
        @cancel="showExpandModal = false;"
        @input="showExpandModal = false; (data[selectedExpandRowIndex] && data[selectedExpandRowIndex].rowMeta && delete data[selectedExpandRowIndex].rowMeta.new)"
        :table="table"
        v-model="data[selectedExpandRowIndex].row"
        :oldRow.sync="data[selectedExpandRowIndex].oldRow"
        :is-new="data[selectedExpandRowIndex].rowMeta.new"
        :selected-row-meta="selectedExpandRowMeta"
        :meta="meta"
        :sql-ui="sqlUi"
        :primary-value-column="primaryValueColumn"
        :api="api"
        @commented="reloadComments"
        :availableColumns="availableColumns"
        :nodes="nodes"
        :query-params="queryParams"
      ></expanded-form>

    </v-dialog>


    <additional-features
      :deleteTable="deleteTable"
      :nodes="nodes"
      v-model="showAddFeatOverlay"
      :type="featureType"
      :table="table"
    ></additional-features>

  </v-container>

</template>

<script>


import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import Table from "@/components/project/table";
import {SqlUI} from "@/helpers/SqlUiFactory";

import NewColumn from "@/components/project/spreadsheet/components/editColumn";
import {mapActions} from "vuex";
import AdditionalFeatures from "@/components/project/spreadsheet/overlay/additinalFeatures";
import ColumnFilter from "~/components/project/spreadsheet/components/columnFilterMenu";
import CreateViewDialog from "@/components/project/spreadsheet/dialog/createViewDialog";
import debounce from 'debounce';
import GalleryView from "@/components/project/spreadsheet/views/galleryView";
import CalendarView from "@/components/project/spreadsheet/views/calendarView";
import KanbanView from "@/components/project/spreadsheet/views/kanbanView";
import XcGridView from "@/components/project/spreadsheet/views/xcGridView";
import SortList from "@/components/project/spreadsheet/components/sortListMenu";
import Fields from "@/components/project/spreadsheet/components/fieldsMenu";
import SpreadsheetNavDrawer from "@/components/project/spreadsheet/components/spreadsheetNavDrawer";
import spreadsheet from "@/components/project/spreadsheet/mixins/spreadsheet";
import LockMenu from "@/components/project/spreadsheet/components/lockMenu";
import ExpandedForm from "@/components/project/spreadsheet/components/expandedForm";
import Pagination from "@/components/project/spreadsheet/components/pagination";

export default {
  mixins: [spreadsheet],
  name: "rows-xc-data-table",
  components: {
    Pagination,
    ExpandedForm,
    LockMenu,
    SpreadsheetNavDrawer,
    Fields,
    SortList,
    XcGridView,
    KanbanView,
    CalendarView,
    GalleryView,
    CreateViewDialog,
    ColumnFilter,
    AdditionalFeatures,
    NewColumn,
    Table,
  },
  props: {
    env: String,
    nodes: Object,
    addNewRelationTab: Function,
    relationType: String,
    relation: Object,
    relationIdValue: [String, Number],
    refTable: String,
    relationPrimaryValue: [String, Number],
    deleteTable: Function,
    showTabs: [Boolean, Number]
  },
  data: () => ({
    dataLoaded: false,
    searchQueryVal: '',
    columnsWidth: null,
    viewStatus: {
      type: null
    },
    fieldsOrder: [],
    showSystemFields: false,
    showAdvanceOptions: false,
    loadViews: false,
    selectedView: {},
    overShieldIcon: false,
    progress: false,
    createViewType: '',
    addNewColModal: false,
    showAddFeatOverlay: false,
    featureType: null,
    addNewColMenu: false,
    newColumn: {},
    shareLink: null,
    loadingMeta: true,
    loadingData: true,
    toggleDrawer: false,
    selectedViewId: 0,
    searchField: null,
    searchQuery: '',
    showExpandModal: false,
    selectedExpandRowIndex: null,
    selectedExpandRowMeta: null,
    navDrawer: true,
    selected: {
      row: null,
      col: null
    },
    editEnabled: {
      row: null,
      col: null
    },
    page: 1,
    count: 0,
    size: 25,
    xWhere: '',
    sort: '',

    cellHeight: 'small',

    spreadsheet: null,
    options: {
      allowToolbar: true,
      columnSorting: false,
    },
    filteredData: [],

    cellHeights: [{
      size: 'small',
      icon: 'mdi-view-headline'
    }, {
      size: 'medium',
      icon: 'mdi-view-sequential'
    }, {
      size: 'large',
      icon: 'mdi-view-stream'
    }, {
      size: 'xlarge',
      icon: 'mdi-card'
    }],
    rowContextMenu: null
  }),
  async mounted() {
    try {
      await this.createTableIfNewTable();
      await this.loadMeta();

      if (this.relationType === 'hm') {
        this.filters.push({
          field: this.meta.columns.find(c => c.cn === this.relation.cn)._cn,
          op: 'is equal',
          value: this.relationIdValue,
          readOnly: true
        })
      } else if (this.relationType === 'bt') {
        this.filters.push({
          // field: this.relation.rcn,
          field: this.meta.columns.find(c => c.cn === this.relation.rcn)._cn,
          op: 'is equal',
          value: this.relationIdValue,
          readOnly: true
        })
      } else {
        // await this.$refs.drawer.loadViews();
        await this.loadTableData();
      }
      this.mapFieldsAndShowFields();
    } catch (e) {
      console.log(e)
    }
    this.searchField = this.primaryValueColumn;
    this.dataLoaded = true;

    // await this.loadViews();
  },
  methods: {
    ...mapActions({
      loadTablesFromChildTreeNode: "project/loadTablesFromChildTreeNode"
    }),
    reloadComments() {
      if (this.$refs.ncgridview) {
        this.$refs.ncgridview.xcAuditModelCommentsCount();
      }
    },
    syncDataDebounce: debounce(async function (self) {
      await self.syncData()
    }, 500),
    async syncData() {
      if (this.relation) return;
      try {

        const query_params = {
          filters: this.filters,
          sortList: this.sortList,
          showFields: this.showFields,
          fieldsOrder: this.fieldsOrder,
          viewStatus: this.viewStatus,
          columnsWidth: this.columnsWidth,
        };

        this.$set(this.selectedView, 'query_params', JSON.stringify(query_params));

        if (!this._isUIAllowed('xcVirtualTableUpdate')) return;
        await this.sqlOp({dbAlias: this.nodes.dbAlias}, 'xcVirtualTableUpdate', {
          id: this.selectedViewId,
          query_params
        });
      } catch (e) {
        // this.$toast.error(e.message).goAway(3000);
      }
    },
    showAdditionalFeatOverlay(feat) {
      this.showAddFeatOverlay = true;
      this.featureType = feat;
    },
    async createTableIfNewTable() {

      if (this.nodes.newTable) {
        const columns = this.sqlUi.getNewTableColumns().filter(col => this.nodes.newTable.columns.includes(col.cn));
        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          "tableCreate",
          {
            tn: this.nodes.tn,
            _tn: this.nodes._tn,
            columns
          }]);
        await this.loadTablesFromChildTreeNode({
          _nodes: {
            ...this.nodes
          }
        });
        delete this.nodes.newTable;
      }

      this.loadViews = true;
    },


    comingSoon() {
      this.$toast.info('Coming soon!').goAway(3000)
    },
    addNewRelationTabCtxMenu(obj, type) {
      const rowObj = this.rowContextMenu.row;

      this.addNewRelationTab(
        obj,
        this.table,
        this.meta._tn || this.table,
        type === 'hm' ? obj.tn : obj.rtn,
        type === 'hm' ? obj._tn : obj._rtn,
        // todo: column name alias
        rowObj[type === 'hm' ? obj.rcn : obj._cn],
        type,
        rowObj,
        rowObj[this.primaryValueColumn]
      )
    },
    changed(col, row) {
      this.$set(this.data[row].rowMeta, 'changed', this.data[row].rowMeta.changed || {});
      if (this.data[row].rowMeta) {
        this.$set(this.data[row].rowMeta.changed, this.availableColumns[col].cn, true);
      }
    },
    async save() {
      for (let row = 0; row < this.rowLength; row++) {
        const {row: rowObj, rowMeta} = this.data[row];
        if (rowMeta.new) {
          try {
            const pks = this.availableColumns.filter((col) => {
              return col.pk;
            });
            if (this.availableColumns.every((col) => {
              return !col.ai;
            }) && pks.length && pks.every(col => !rowObj[col._cn])) {
              return this.$toast.info('Primary column is empty please provide some value').goAway(3000);
            }
            if (this.availableColumns.some((col) => {
              return col.rqd && (rowObj[col._cn] === undefined || rowObj[col._cn] === null) && !col.default
            })) {
              return;
            }

            const insertObj = this.availableColumns.reduce((o, col) => {
              if (!col.ai && (rowObj && rowObj[col._cn]) !== null) {
                o[col._cn] = rowObj && rowObj[col._cn];
              }
              return o;
            }, {});

            const insertedData = await this.api.insert(insertObj);
            this.data.splice(row, 1, {
              row: insertedData,
              rowMeta: {},
              oldRow: {...insertedData}
            });

            this.$toast.success(`${insertedData[this.primaryValueColumn] ? `${insertedData[this.primaryValueColumn]}'s r` : 'R'}ow saved successfully.`, {
              position: 'bottom-center'
            }).goAway(3000);

          } catch (e) {
            if (e.response && e.response.data && e.response.data.msg) {
              this.$toast.error(e.response.data.msg).goAway(3000)
            } else {
              this.$toast.error(`Failed to save row : ${e.message}`).goAway(3000)
            }
          }
        }
      }
    },


    onCellValueChangeDebounce: debounce(async function (col, row, column, self) {
      await self.onCellValueChangeFn(col, row, column)
    }, 300),
    onCellValueChange(col, row, column) {
      this.onCellValueChangeDebounce(col, row, column, this)
    },
    async onCellValueChangeFn(col, row, column) {
      if (!this.data[row]) return;
      const {row: rowObj, rowMeta, oldRow} = this.data[row];
      if (rowMeta.new) {
        await this.save()
      } else {
        try {
          if (!this.api) return;
          const id = this.meta.columns.filter((c) => c.pk).map(c => rowObj[c._cn]).join('___');
          await this.api.update(id, {
            [column._cn]: rowObj[column._cn]
          }, {[column._cn]: oldRow[column._cn]})
          this.$set(oldRow, column._cn, rowObj[column._cn])
          this.$toast.success(`${rowObj[this.primaryValueColumn] ? `${rowObj[this.primaryValueColumn]}'s c` : 'C'}olumn '${column.cn}' updated successfully.`, {
            position: 'bottom-center'
          }).goAway(3000);
        } catch (e) {
          if (e.response && e.response.data && e.response.data.msg) {
            this.$toast.error(e.response.data.msg).goAway(3000)
          } else {
            this.$toast.error(`Failed to update row : ${e.message}`).goAway(3000)
          }
        }
      }
    },
    async deleteRow() {
      try {
        const rowObj = this.rowContextMenu.row;
        if (!this.rowContextMenu.rowMeta.new) {
          const id = this.meta && this.meta.columns && this.meta.columns.filter((c) => c.pk).map(c => rowObj[c._cn]).join('___');
          await this.api.delete(id);
        }
        this.data.splice(this.rowContextMenu.index, 1);
        this.$toast.success(`Deleted row successfully`).goAway(3000)
      } catch (e) {
        this.$toast.error(`Failed to delete row : ${e.message}`).goAway(3000)
      }
    },
    async deleteSelectedRows() {
      let row = this.rowLength
      while (row--) {
        try {
          const {row: rowObj, rowMeta} = this.data[row];
          if (!rowMeta.selected) {
            continue;
          }
          if (!rowMeta.new) {
            const id = this.meta.columns.filter((c) => c.pk).map(c => rowObj[c._cn]).join('___');
            await this.api.delete(id);
          }
          this.data.splice(row, 1);
        } catch (e) {
          return this.$toast.error(`Failed to delete row : ${e.message}`).goAway(3000)
        }

        this.$toast.success(`Deleted selected rows successfully`).goAway(3000)
      }
    },
    async insertNewRow(atEnd = false, expand = false) {
      const focusRow = atEnd ? this.rowLength : this.rowContextMenu.index + 1;
      const focusCol = this.availableColumns.findIndex(c => !c.ai);
      this.data.splice(focusRow, 0, {
        row: this.relationType === 'hm' ? {
          ...this.fieldList.reduce((o, f) => ({...o, [f]: null}), {}),
          [this.relation.cn]: this.relationIdValue
        } : this.fieldList.reduce((o, f) => ({...o, [f]: null}), {}),
        rowMeta: {
          new: true
        }, oldRow: {}
      });

      this.selected = {row: focusRow, col: focusCol}
      this.editEnabled = {row: focusRow, col: focusCol}

      if (expand) {
        const {rowMeta} = this.data[this.data.length - 1];
        this.expandRow(this.data.length - 1, rowMeta)
      }
      this.save()
    },


    async handleKeyDown({metaKey, key, altKey, shiftKey, ctrlKey}) {
      switch ([
        this._isMac ? metaKey : ctrlKey
        , key].join('_')) {
        case 'true_s' :
          this.edited && await this.save();
          break;
        case 'true_l' :
          await this.loadTableData();
          break;
        case 'true_n' :
          this.insertNewRow(true);
          break;
      }
    },
    async loadMeta(updateShowFields = true) {
      this.loadingMeta = true;
      const tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        tn: this.table
      }]);
      this.meta = JSON.parse(tableMeta.meta);
      this.loadingMeta = false;
      if (updateShowFields) {
        try {
          const qp = JSON.parse(tableMeta.query_params)
          this.showFields = qp.showFields ? qp.showFields : this.showFields;
        } catch (e) {
        }
      }
    },
    loadTableDataDeb: debounce(async function (self) {
      await self.loadTableDataFn()
    }, 100),
    loadTableData() {
      this.loadTableDataDeb(this)
    },
    async loadTableDataFn() {
      this.loadingData = true;
      try {
        if (this.api) {
          const {list, count} = await this.api.paginatedList(this.queryParams);
          this.count = count;
          this.data = list.map(row => ({
            row,
            oldRow: {...row},
            rowMeta: {}
          }));
        }
      } catch (e) {
        console.log(e);
      }
      this.loadingData = false;
    },
    showRowContextMenu(e, row, rowMeta, index) {
      e.preventDefault();
      this.rowContextMenu = false;
      this.$nextTick(() => {
        this.rowContextMenu = {
          x: e.clientX,
          y: e.clientY,
          row, index, rowMeta
        }
      });
    },
    expandRow(row, rowMeta) {
      this.showExpandModal = true;
      this.selectedExpandRowIndex = row;
      this.selectedExpandRowMeta = rowMeta;
    },
    async onNewColCreation() {
      await this.loadMeta(true);
      this.$nextTick(async () => {
        await this.loadTableData();
        // this.mapFieldsAndShowFields();
      });
    }
  },
  computed: {
    currentApiUrl() {
      return this.api && `${this.api.apiUrl}?` + Object.entries(this.queryParams).filter(p => p[1]).map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`).join('&')
    },
    isEditable() {
      return this._isUIAllowed('xcDatatableEditable')
    },
    sqlUi() {
      return SqlUI.create(this.nodes.dbConnection);
    },
    api() {
      return this.meta && this.meta._tn ? ApiFactory.create(this.$store.getters['project/GtrProjectType'], this.meta && this.meta._tn, this.meta && this.meta.columns, this) : null;
    }
  },

}
</script>

<style scoped>


/deep/ .v-input__control .v-input__slot .v-input--selection-controls__input {
  transform: scale(.85);
  margin-right: 0;
}

/deep/ .xc-toolbar .v-input__slot, .navigation .v-input__slot {
  box-shadow: none !important;
}

/deep/ .navigation .v-input__slot input::placeholder {
  font-size: .8rem;
}

/deep/ .v-btn {
  text-transform: capitalize;
}


.row-expand-icon, .row-checkbox {
  opacity: 0;
}

/deep/ .row-checkbox .v-input__control {
  height: 24px !important;
}


.cell-height-medium td, .cell-height-medium tr {
  min-height: 35px !important;
  /*height: 35px !important;*/
  /*max-height: 35px !important;*/
}

.cell-height-large td, .cell-height-large tr {
  min-height: 40px !important;
  /*height: 40px !important;*/
  /*max-height: 40px !important;*/
}

.cell-height-xlarge td, .cell-height-xlarge tr {
  min-height: 50px !important;
  /*height: 50px !important;*/
  /*max-height: 50px !important;*/
}


/deep/ .xc-border.search-box {
  overflow: visible;
  border-radius: 4px;
}

/deep/ .xc-border.search-box .v-input {
  transition: .4s border-color;
}

/deep/ .xc-border.search-box .v-input--is-focused {
  border: 1px solid var(--v-primary-base) !important;
  margin: -1px;
}

/deep/ .search-field.v-text-field.v-text-field--solo.v-input--dense > .v-input__control {
  min-height: auto;
}


.views-navigation-drawer {
  transition: .4s max-width, .4s min-width;
}


.new-column-header {
  text-align: center;
  min-width: 70px;
}


/deep/ .v-input__control label {
  font-size: inherit;
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
