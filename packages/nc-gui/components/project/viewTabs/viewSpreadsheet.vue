<template>
  <v-container class=" j-excel-container pa-0 ma-0" fluid>
    <div v-if="modelName" class="model-name text-capitalize">
      <span class="font-weight-bold"> {{ modelName }}</span> <span class="font-weight-regular ml-1">( Main View )</span>
    </div>

    <v-toolbar height="36" dense class="elevation-0 xc-toolbar xc-border-bottom" style="z-index: 7;border-radius: 4px">
      <div class="d-flex xc-border align-center search-box">
        <v-menu bottom offset-y>
          <template #activator="{on}">
            <div v-on="on">
              <v-icon
                class="pa-1 pr-0 ml-2"
                small
                color="grey"
              >
                mdi-magnify
              </v-icon>

              <v-icon
                color="grey"
                class="pl-0 pa-1"
                small
              >
                mdi-menu-down
              </v-icon>
            </div>
          </template>
          <v-list dense>
            <v-list-item
              v-for="col in meta.columns"
              :key="col.cn"
              @click="searchField = col.cn"
            >
              <span class="caption">{{ col.cn }}</span>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-divider
          vertical
        />

        <v-text-field
          v-model="searchQuery"
          autocomplete="off"
          style="min-width: 300px"
          flat
          dense
          solo
          hide-details
          :placeholder="searchField ? `Search '${searchField}' column` : 'Search all columns'"
          class="elevation-0 pa-0 flex-grow-1 caption search-field"
          @keyup.enter="loadTableData"
          @blur="loadTableData"
        />
      </div>

      <span
        v-if="relationType && false"
        class="caption grey--text"
      >{{ refTable }}({{
        relationPrimaryValue
      }}) -> {{ relationType === 'hm' ? ' Has Many ' : ' Belongs To ' }} -> {{ table }}</span>

      <v-spacer />

      <v-btn outlined small text @click="loadTableData">
        <v-icon small class="mr-1" color="grey  darken-3">
          mdi-reload
        </v-icon>
        Reload
      </v-btn>

      <fields-menu v-model="showFields" :field-list="fieldList" />

      <sort-list-menu v-model="sortList" :field-list="fieldList" />

      <column-filter-menu v-model="filters" :field-list="fieldList" />

      <v-menu>
        <template #activator="{ on, attrs }">
          <v-icon
            v-bind="attrs"
            small
            class="mx-2"
            color="grey  darken-3"
            v-on="on"
          >
            mdi-arrow-collapse-vertical
          </v-icon>
        </template>

        <v-list dense class="caption">
          <v-list-item v-for="h in cellHeights" :key="h.size" dense @click.stop="cellHeight = h.size">
            <v-list-item-icon class="mr-1">
              <v-icon small :color="cellHeight === h.size && 'primary'">
                {{ h.icon }}
              </v-icon>
            </v-list-item-icon>
            <v-list-item-title :class="{'primary--text' : cellHeight === h.size}" style="text-transform: capitalize">
              {{ h.size }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-toolbar>
    <div
      :class="`cell-height-${cellHeight}`"
      style="overflow:auto;transition: width 500ms ;height : calc(100% - 36px)"
      class="d-flex"
    >
      <div class="flex-grow-1 h-100" style="overflow-y: auto">
        <div ref="table" style="  overflow: auto;width:100%">
          <v-skeleton-loader v-if="loadingData" type="table" />

          <template v-else-if="selectedView && (selectedView.type === 'view' || selectedView.show_as === 'grid' )">
            <xc-grid-view
              :meta="meta"
              :data="data"
              :available-columns="availableColumns"
              :show-fields="showFields"
              :belongs-to="[]"
              :has-many="[]"
              :is-public-view="true"
              :nodes="{dbAlias:''}"
              :sql-ui="sqlUi"
            />
          </template>
          <template v-else-if="selectedView && selectedView.show_as === 'gallery' ">
            <gallery-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :primary-value-column="primaryValueColumn"
            />
          </template>
          <template v-else-if="selectedView && selectedView.show_as === 'kanban' ">
            <kanban-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :primary-value-column="primaryValueColumn"
            />
          </template>
          <template v-else-if="selectedView && selectedView.show_as === 'calendar' ">
            <calendar-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :primary-value-column="primaryValueColumn"
            />
          </template>
        </div>

        <v-pagination
          v-if="data"
          v-model="page"
          style="max-width: 100%"
          :length="Math.ceil(count / size)"
          :total-visible="8"
          color="primary lighten-2"
          @input="loadTableData"
        />
        <!--      <div v-else class="d-flex justify-center py-4">-->
        <!--        <v-alert type="info" dense class="ma-1 flex-shrink-1">Table is empty</v-alert>-->
        <!--      </div>-->
      </div>

      <spreadsheet-nav-drawer
        :nodes="nodes"
        :table="table"
        :meta="meta"
        :primary-value-column="primaryValueColumn"
        :concatenated-x-where="concatenatedXWhere"
        :sort="sort"

        :selected-view-id.sync="selectedViewId"
        :selected-view.sync="selectedView"
        :filters.sync="filters"
        :sort-list.sync="sortList"
        :show-fields.sync="showFields"
      >
        <v-list-item
          @click="showAdditionalFeatOverlay('view-columns')"
        >
          <v-icon x-small class="mr-2">
            mdi-view-column
          </v-icon>
          <span class="caption">View Columns</span>
        </v-list-item>
        <v-list-item
          @click="showAdditionalFeatOverlay('view-acl')"
        >
          <v-icon x-small class="mr-2">
            mdi-shield-edit-outline
          </v-icon>
          <span class="caption"> ACL</span>
        </v-list-item>
      </spreadsheet-nav-drawer>
    </div>

    <additional-features
      v-model="showAddFeatOverlay"
      :nodes="nodes"
      :type="featureType"
    />
  </v-container>
</template>

<script>

import ApiFactory from '@/components/project/spreadsheet/apis/apiFactory'
// import Table from '@/components/project/table'
// import EditableCell from "@/components/project/spreadsheet/editableCell";
import { SqlUI } from '@/helpers/sqlUi/SqlUiFactory'
import FieldsMenu from '@/components/project/spreadsheet/components/fieldsMenu'
import SortListMenu from '@/components/project/spreadsheet/components/sortListMenu'
import ColumnFilterMenu from '@/components/project/spreadsheet/components/columnFilterMenu'
import XcGridView from '@/components/project/spreadsheet/views/xcGridView'
import SpreadsheetNavDrawer from '@/components/project/spreadsheet/components/spreadsheetNavDrawer'
import debounce from 'debounce'
import GalleryView from '@/components/project/spreadsheet/views/galleryView'
import KanbanView from '@/components/project/spreadsheet/views/kanbanView'
import CalendarView from '@/components/project/spreadsheet/views/calendarView'
import AdditionalFeatures from '@/components/project/spreadsheet/overlay/additinalFeatures'
import spreadsheet from '@/components/project/spreadsheet/mixins/spreadsheet'
// import ExpandedForm from "@/components/project/spreadsheet/expandedForm";

export default {
  name: 'Spreadsheet',
  components: {
    AdditionalFeatures,
    CalendarView,
    KanbanView,
    GalleryView,
    SpreadsheetNavDrawer,
    XcGridView,
    ColumnFilterMenu,
    SortListMenu,
    FieldsMenu
  },
  mixins: [spreadsheet],
  props: {
    dbAlias: String,
    env: String,
    nodes: Object,
    relationType: String,
    relation: Object,
    relationIdValue: [String, Number],
    refTable: String,
    relationPrimaryValue: [String, Number]
  },
  data: () => ({
    showAddFeatOverlay: false,
    featureType: null,
    selectedViewId: null,
    selectedView: null,
    shareLink: null,
    showShareModel: false,
    loadingMeta: true,
    loadingData: true,
    toggleDrawer: false,
    selectedItem: 0,
    searchField: null,
    searchQuery: '',
    showExpandModal: false,
    selectedExpandRowIndex: null,
    selectedExpandRowMeta: null,
    meta: [],
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

    isAnyFieldHidden: false,
    opList: ['is equal', 'is not equal', 'is like', 'is not like', 'is empty', 'is not empty', 'is null', 'is not null'],
    spreadsheet: null,
    options: {
      allowToolbar: true,
      columnSorting: false
    },
    filteredData: [],
    showFields: {},
    fieldList: [],

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
    rowContextMenu: null,
    modelName: null
  }),
  async mounted() {
    try {
      await this.loadMeta()
      await this.loadTableData()
    } catch (e) {
      console.log(e)
    }
    this.mapFieldsAndShowFields()
    if (this.data.length) {
      // eslint-disable-next-line no-unused-vars
      const options = {
        ...this.options,
        columns: [...this.meta.columns.map((col) => {
          return {
            readOnly: col.ai,
            type: typeof this.data[0][col.cn],
            title: col.cn,
            width: '150px'
          }
        }), {
          type: 'hidden',
          key: ''
        }]
      }
    }
    this.searchField = this.primaryValueColumn
  },

  methods: {
    syncDataDebounce: debounce(async function(self) {
      await self.syncData()
    }, 500),
    async syncData() {
      try {
        const queryParams = {
          filters: this.filters,
          sortList: this.sortList,
          showFields: this.showFields
        }

        this.$set(this.selectedView, 'query_params', JSON.stringify(queryParams))

        if (!this._isUIAllowed('xcVirtualTableUpdate')) { return }
        await this.sqlOp({ dbAlias: this.nodes.dbAlias }, 'xcVirtualTableUpdate', {
          id: this.selectedViewId,
          query_params: queryParams
        })
      } catch (e) {
        // this.$toast.error(e.message).goAway(3000);
      }
    },
    mapFieldsAndShowFields() {
      this.fieldList = this.availableColumns.map(c => c._cn)
      this.showFields = this.fieldList.reduce((obj, k) => {
        obj[k] = true
        return obj
      }, {})
    },

    comingSoon() {
      this.$toast.info('Coming soon!').goAway(3000)
    },
    makeSelected(col, row) {
      if (this.selected.col !== col || this.selected.row !== row) {
        this.selected = { col, row }
        this.editEnabled = {}
      }
    },
    makeEditable(col, row) {
      if (this.meta.columns[col].ai) {
        return this.$toast.info('Auto Increment field is not editable').goAway(3000)
      }
      if (this.meta.columns[col].pk && !this.data[row].rowMeta.new) {
        return this.$toast.info('Editing primary key not supported').goAway(3000)
      }
      if (this.editEnabled.col !== col || this.editEnabled.row !== row) {
        this.editEnabled = { col, row }
      }
    },

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
      // ctrl + s -> save
      // ctrl + l -> reload
      // ctrl + n -> new
      switch ([
        this._isMac ? metaKey : ctrlKey,
        key].join('_')) {
        case 'true_s' :
          this.edited && await this.save()
          break
        case 'true_l' :
          await this.loadTableData()
          break
        case 'true_n' :
          this.insertNewRow(true)
          break
      }
    },

    addFilter() {
      this.filters.push({
        field: '',
        op: '',
        value: '',
        logicOp: 'and'
      })
      this.filters = this.filters.slice()
    },
    showAdditionalFeatOverlay(feat) {
      this.showAddFeatOverlay = true
      this.featureType = feat
    },
    addSort() {
      this.sortList.push({
        field: '',
        order: ''
      })
      this.filters = this.filters.slice()
    },
    showRowContextMenu(e, row, rowMeta, index) {
      e.preventDefault()
      this.rowContextMenu = false
      this.$nextTick(() => {
        this.rowContextMenu = {
          x: e.clientX,
          y: e.clientY,
          row,
          index,
          rowMeta
        }
      })
    },
    expandRow(row, rowMeta) {
    },

    async loadMeta() {
      this.loadingMeta = true
      const tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        tn: this.table
      }])
      this.meta = JSON.parse(tableMeta.meta)
      this.loadingMeta = false
    },
    async loadTableData() {
      this.loadingData = true
      const { list, count } = await this.api.paginatedList(this.queryParams)
      this.count = count
      this.data = list.map(row => ({
        row,
        oldRow: { ...row },
        rowMeta: {}
      }))
      this.loadingData = false
    }
  },
  computed: {
    sqlUi() {
      // todo: replace with correct client
      return SqlUI.create(this.nodes.dbConnection)
    },
    api() {
      return ApiFactory.create(this.$store.getters['project/GtrProjectType'], (this.meta && this.meta._tn) || this.table, this.meta && this.meta.columns, this, this.meta)
    },
    edited() {
      return this.data && this.data.some(r => r.rowMeta && (r.rowMeta.new || r.rowMeta.changed))
    },
    table() {
      return this.nodes.tn || this.nodes.view_name
    }
  },
  created() {
    if (this.relationType === 'hm') {
      this.filters.push({
        field: this.relation.cn,
        op: 'is equal',
        value: this.relationIdValue,
        readOnly: true
      })
    } else if (this.relationType === 'bt') {
      this.filters.push({
        field: this.relation.rcn,
        op: 'is equal',
        value: this.relationIdValue,
        readOnly: true
      })
    }
    document.addEventListener('keydown', this.onKeyDown)
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown)
  }
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

/deep/ .xc-bt-chip {
  margin-right: 12px;
  transition: .4s margin-right, .4s padding-right;
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

.model-name {
  position: fixed;
  top: 5px;
  pointer-events: none;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 9999;
  width: 100%;
  font-size: 1.2rem;
  color: white;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
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
