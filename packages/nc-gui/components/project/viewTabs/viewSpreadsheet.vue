<template>
  <v-container class="h-100 j-excel-container backgroundColor pa-0 ma-0" fluid>
    <div v-if="modelName" class="model-name text-capitalize">
      <span class="font-weight-bold"> {{ modelName }}</span> <span class="font-weight-regular ml-1">( Main View )</span>
    </div>
    <v-toolbar
      height="32"
      dense
      class="nc-table-toolbar elevation-0 xc-toolbar xc-border-bottom mx-1"
      style="z-index: 7"
    >
      <div class="d-flex xc-border align-center search-box" style="min-width:156px">
        <v-menu bottom offset-y>
          <template #activator="{on}">
            <div style="min-width: 56px" v-on="on">
              <v-icon
                class="ml-2"
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
          <v-list v-if="meta" dense>
            <v-list-item
              v-for="col in meta.columns"
              :key="col.column_name"
              @click="searchField = col.column_name"
            >
              <span class="caption">{{ col.column_name }}</span>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-divider
          vertical
        />

        <v-text-field
          v-model="searchQuery"
          autocomplete="off"
          style="min-width: 100px ; width: 150px"
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

      <div class="d-inline-flex">
        <fields-menu v-model="showFields" :field-list="fieldList" :is-locked="isLocked" />

        <sort-list-menu v-model="sortList" :field-list="fieldList" :is-locked="isLocked" />

        <column-filter-menu v-model="filters" :field-list="fieldList" :is-locked="isLocked" />

        <share-view-menu @share="$refs.drawer && $refs.drawer.genShareLink()" />

        <MoreActions
          ref="csvExportImport"
          :meta="meta"
          :nodes="nodes"
          :query-params="{
            fieldsOrder,
            fieldFilter,
            sortList,
            showFields
          }"
          :selected-view="selectedView"
          :is-view="true"
          @showAdditionalFeatOverlay="showAdditionalFeatOverlay($event)"
          @webhook="showAdditionalFeatOverlay('webhooks')"
        />
      </div>
      <v-spacer class="h-100" @dblclick="debug=true" />

      <template>
        <debug-metas v-if="debug" class="mr-3" />
        <lock-menu v-if="_isUIAllowed('view-type')" v-model="viewStatus.type" />
        <v-icon small class="mx-n1" color="grey lighten-1">
          mdi-circle-small
        </v-icon>
        <x-icon
          tooltip="Reload view data"
          icon.class="nc-table-reload-btn mx-1"
          small
          @click="loadTableData"
        >
          mdi-reload
        </x-icon>
      </template>

      <x-btn
        tooltip="Toggle navigation drawer"
        outlined
        small
        text
        :btn-class="{ 'primary lighten-5 nc-toggle-nav-drawer' : !toggleDrawer}"
        @click="toggleDrawer = !toggleDrawer"
      >
        <v-icon
          small
          class="mx-0"
          color="grey  darken-3"
        >
          {{ toggleDrawer ? 'mdi-door-closed' : 'mdi-door-open' }}
        </v-icon>
      </x-btn>
    </v-toolbar>
    <div
      :class="`cell-height-${cellHeight}`"
      style="overflow:auto;transition: width 500ms ;height : calc(100% - 36px)"
      class="d-flex backgroundColor"
    >
      <div class="flex-grow-1 h-100" style="overflow-y: auto">
        <div ref="table" style="  overflow: auto;width:100%; height: calc(100% - 36px);">
          <v-skeleton-loader v-if="loadingData" type="table" />

          <template v-else-if="selectedView && (selectedView.type === 'view' || selectedView.show_as === 'grid' )">
            <xc-grid-view
              :columns-width.sync="columnsWidth"
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
        ref="drawer"
        :nodes="nodes"
        :table="table"
        :meta="meta"
        :toggle-drawer="toggleDrawer"
        :primary-value-column="primaryValueColumn"
        :concatenated-x-where="concatenatedXWhere"
        :sort="sort"
        :columns-width.sync="columnsWidth"
        :selected-view-id.sync="selectedViewId"
        :selected-view.sync="selectedView"
        :filters.sync="filters"
        :sort-list.sync="sortList"
        :show-fields.sync="showFields"
        :view-status.sync="viewStatus"
      >
        <!--        <v-list-item
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
        </v-list-item>-->
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

import debounce from 'debounce'
import { SqlUI } from '@/helpers/sqlUi/SqlUiFactory'
import FieldsMenu from '@/components/project/spreadsheet/components/fieldsMenu'
import SortListMenu from '@/components/project/spreadsheet/components/sortListMenu'
import ColumnFilterMenu from '@/components/project/spreadsheet/components/columnFilterMenu'
import XcGridView from '@/components/project/spreadsheet/views/xcGridView'
import SpreadsheetNavDrawer from '@/components/project/spreadsheet/components/spreadsheetNavDrawer'
import GalleryView from '@/components/project/spreadsheet/views/galleryView'
import KanbanView from '@/components/project/spreadsheet/views/kanbanView'
import CalendarView from '@/components/project/spreadsheet/views/calendarView'
import AdditionalFeatures from '@/components/project/spreadsheet/overlay/additinalFeatures'
import spreadsheet from '@/components/project/spreadsheet/mixins/spreadsheet'
import MoreActions from '@/components/project/spreadsheet/components/moreActions'
import ShareViewMenu from '@/components/project/spreadsheet/components/shareViewMenu'
import LockMenu from '@/components/project/spreadsheet/components/lockMenu'

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
    FieldsMenu,
    ShareViewMenu,
    MoreActions,
    LockMenu
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
    columnsWidth: null,
    syncDataDebounce: debounce(async function(self) {
      await self.syncData()
    }, 500),
    fieldsOrder: [],
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
    // meta: null,
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
    // fieldList: [],

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
    modelName: null,
    viewStatus: {
      type: null
    }
  }),
  computed: {
    meta() {
      return this.$store.state.meta.metas[this.table]
    },
    sqlUi() {
      // todo: replace with correct client
      return SqlUI.create(this.nodes.dbConnection)
    },
    api() {
      return this.meta && this.$ncApis.get({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        table: this.meta.table_name
      })
    },
    edited() {
      return this.data && this.data.some(r => r.rowMeta && (r.rowMeta.new || r.rowMeta.changed))
    },
    table() {
      return this.nodes.table_name || this.nodes.view_name
    }
  },
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
            type: typeof this.data[0][col.column_name],
            title: col.column_name,
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
  created() {
    if (this.relationType === 'hm') {
      this.filters.push({
        field: this.relation.column_name,
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
  },

  methods: {
    // syncDataDebounce: debounce(async function(self) {
    //   await self.syncData()
    // }, 500),
    async syncData() {
      if (this.relation) {
        return
      }
      try {
        const queryParams = {
          filters: this.filters,
          sortList: this.sortList,
          showFields: this.showFields,
          fieldsOrder: this.fieldsOrder,
          viewStatus: this.viewStatus,
          columnsWidth: this.columnsWidth,
          showSystemFields: this.showSystemFields,
          extraViewParams: this.extraViewParams
        }

        if (this.isGallery) {
          queryParams.coverImageField = this.coverImageField
        }

        this.$set(this.selectedView, 'query_params', JSON.stringify(queryParams))

        if (!this._isUIAllowed('xcVirtualTableUpdate')) {
          return
        }
        await this.sqlOp({ dbAlias: this.nodes.dbAlias }, 'xcVirtualTableUpdate', {
          id: this.selectedViewId,
          query_params: queryParams,
          table_name: this.meta.table_name,
          view_name: this.$route.query.view
        })
      } catch (e) {
        // this.$toast.error(e.message).goAway(3000);
      }
    },
    mapFieldsAndShowFields() {
      this.fieldList = this.availableColumns.map(c => c.title)
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

      await this.$store.dispatch('meta/ActLoadMeta', {
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        table_name: this.table,
        force: true
      })

      // const tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'tableXcModelGet', {
      //   table_name: this.table
      // }])
      // this.meta = JSON.parse(tableMeta.meta)
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
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
