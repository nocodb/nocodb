<template>
  <v-container class="h-100 j-excel-container backgroundColor pa-0 ma-0" fluid>
    <v-toolbar
      height="32"
      dense
      class="nc-table-toolbar elevation-0 xc-toolbar xc-border-bottom mx-1"
      style="z-index: 7"
    >
      <div v-if="!isForm" class="d-flex xc-border align-center search-box" style="min-width:156px">
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
          <v-list dense>
            <v-list-item
              v-for="col in availableRealColumns"
              :key="col.cn"
              @click="searchField = col._cn"
            >
              <span class="caption">{{ col._cn }}</span>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-divider
          vertical
        />

        <v-text-field
          v-model="searchQueryVal"
          autocomplete="new-password"
          style="min-width: 100px ; width: 150px"
          flat
          dense
          solo
          hide-details
          :placeholder="searchField ? $t('placeholder.searchColumn', {searchField}) : 'Search all columns'"
          class="elevation-0 pa-0 flex-grow-1 caption search-field"
          @keyup.enter="searchQuery = searchQueryVal"
          @blur="searchQuery = searchQueryVal"
        />
      </div>

      <span
        v-if="relationType && false"
        class="caption grey--text"
      >{{ refTable }}({{
        relationPrimaryValue
      }}) -> {{ relationType === 'hm' ? ' Has Many ' : ' Belongs To ' }} -> {{ table }}</span>
      <div class="d-inline-flex">
        <fields
          v-if="!isForm"
          v-model="showFields"
          :field-list="fieldList"
          :meta="meta"
          :is-locked="isLocked"
          :fields-order.sync="fieldsOrder"
          :sql-ui="sqlUi"
          :show-system-fields.sync="showSystemFields"
          :cover-image-field.sync="coverImageField"
          :grouping-field.sync="groupingField"
          :is-gallery="isGallery"
          :is-kanban="isKanban"
        />

        <sort-list
          v-if="!isForm"
          v-model="sortList"
          :is-locked="isLocked"
          :field-list="[...realFieldList, ...formulaFieldList]"
        />
        <column-filter
          v-if="!isForm"
          v-model="filters"
          :meta="meta"
          :is-locked="isLocked"
          :field-list="[...realFieldList, ...formulaFieldList]"
          dense
        />

        <share-view-menu @share="$refs.drawer && $refs.drawer.genShareLink()" />

        <MoreActions
          v-if="!isForm"
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
          @showAdditionalFeatOverlay="showAdditionalFeatOverlay($event)"
          @webhook="showAdditionalFeatOverlay('webhooks')"
          @reload="reload"
        />
      </div>
      <v-spacer class="h-100" @dblclick="debug=true" />

      <template v-if="!isForm">
        <debug-metas v-if="debug" class="mr-3" />
        <v-tooltip bottom>
          <template #activator="{on}">
            <v-icon v-if="!isPkAvail && !isForm" color="warning" small class="mr-3" v-on="on">
              mdi-information-outline
            </v-icon>
          </template>
          <span class="caption">          Update & Delete not allowed since the table doesn't have any primary key
          </span>
        </v-tooltip>
        <lock-menu v-if="_isUIAllowed('view-type')" v-model="viewStatus.type" />

        <!--        <x-btn
          tooltip="Reload view data"
          outlined
          small
          text
          btn.class="nc-table-reload-btn px-0"
          @click="reload"
        >-->
        <v-icon small class="mx-n1" color="grey lighten-1">
          mdi-circle-small
        </v-icon>
        <!-- tooltip="Reload view data" -->
        <x-icon
          tooltip="Reload view data"
          icon.class="nc-table-reload-btn mx-1"
          small
          @click="reload"
        >
          mdi-reload
        </x-icon>
        <v-icon
          v-if="isEditable && relationType !== 'bt'"
          small
          class="mx-n1"
          color="grey lighten-1"
        >
          mdi-circle-small
        </v-icon>
        <!--        </x-btn>-->
        <!--        <x-btn-->
        <!--          v-if="isEditable && relationType !== 'bt'"-->
        <!--          tooltip="Add new row"-->
        <!--          :disabled="isLocked"-->
        <!--          outlined-->
        <!--          small-->
        <!--          text-->
        <!--          btn.class="nc-add-new-row-btn"-->
        <!--          @click="insertNewRow(true,true)"-->
        <!--        >-->

        <!--          tooltip="Add new row"-->
        <x-icon
          v-if="isEditable && relationType !== 'bt'"
          icon.class="nc-add-new-row-btn mx-1"
          :tooltip="$t('activity.addRow')"
          :disabled="isLocked"
          small
          :color="['success','']"
          @click="insertNewRow(true,true)"
        >
          mdi-plus-outline
        </x-icon>
        <!--        </x-btn>-->
        <!--        <x-btn
          small
          text
          btn.class="nc-save-new-row-btn"
          outlined
          tooltip="Save new rows"
          :disabled="!edited || isLocked"
          @click="save"
        >
          <v-icon small class="mr-1" color="grey  darken-3">
            save
          </v-icon>
          Save
        </x-btn>-->
        <!--        <v-tooltip-->
        <!--          bottom-->
        <!--        >-->
        <!--          <template #activator="{on}">-->
        <!--            <v-btn
              v-show="_isUIAllowed('table-delete')"
              class="nc-table-delete-btn"
              :disabled="isLocked"
              small
              outlined
              text
              v-on="on"
              @click="checkAndDeleteTable"
            >-->
        <v-icon
          v-if="_isUIAllowed('table-delete')"
          small
          class="mx-n1"
          color="grey lighten-1"
        >
          mdi-circle-small
        </v-icon>
        <x-icon
          v-if="_isUIAllowed('table-delete')"
          icon.class="nc-table-delete-btn mx-1 mr-1"
          :disabled="isLocked"
          small
          :color="['red',''] "
          :tooltip="$t('activity.deleteTable')"
          @click="checkAndDeleteTable"
        >
          mdi-delete-outline
        </x-icon>

        <v-icon small class="ml-n2" color="grey lighten-1">
          mdi-circle-small
        </v-icon>
        <!--            </v-btn>-->
        <!--          </template>-->
        <!--          <span class="">Delete table</span>-->
        <!--        </v-tooltip>-->
      </template>

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
      style=" height:calc(100% - 32px);overflow:auto;transition: width 100ms "
      class="d-flex"
    >
      <div class="flex-grow-1 h-100" style="overflow-y: auto">
        <div
          ref="table"
          :style="{height:isForm ? '100%' : 'calc(100% - 36px)'}"
          style="overflow: auto;width:100%"
        >
          <v-skeleton-loader v-if="!dataLoaded && loadingData || !meta" type="table" />
          <template v-else-if="selectedView && (selectedView.type === 'table' || selectedView.show_as === 'grid' )">
            <xc-grid-view
              :key="key + selectedViewId"
              ref="ncgridview"
              droppable
              :relation-type="relationType"
              :columns-width.sync="columnsWidth"
              :is-locked="isLocked"
              :table="table"
              :available-columns="availableColumns"
              :show-fields="showFields"
              :sql-ui="sqlUi"
              :is-editable="isEditable"
              :nodes="nodes"
              :primary-value-column="primaryValueColumn"
              :belongs-to="belongsTo"
              :has-many="hasMany"
              :data="data"
              :visible-col-length="visibleColLength"
              :meta="meta"
              :is-virtual="selectedView.type === 'vtable'"
              :api="api"
              :is-pk-avail="isPkAvail"
              @drop="onFileDrop"
              @onNewColCreation="onNewColCreation"
              @onCellValueChange="onCellValueChange"
              @insertNewRow="insertNewRow"
              @showRowContextMenu="showRowContextMenu"
              @addNewRelationTab="addNewRelationTab"
              @expandRow="expandRow"
              @onRelationDelete="loadMeta"
              @loadTableData="loadTableData"
              @loadMeta="loadMeta"
            />
          </template>
          <template v-else-if="isGallery ">
            <gallery-view
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :sql-ui="sqlUi"
              :primary-value-column="primaryValueColumn"
              :cover-image-field="coverImageField"
              @expandForm="({rowIndex,rowMeta}) => expandRow(rowIndex,rowMeta)"
            />
          </template>
          <template v-else-if="isKanban">
            <v-container v-if="kanban.loadingData" fluid>
              <v-row>
                <v-col v-for="idx in 5" :key="idx">
                  <v-skeleton-loader type="image@3" />
                </v-col>
              </v-row>
            </v-container>
            <kanban-view
              v-if="!kanban.loadingData && kanban.data.length"
              :nodes="nodes"
              :table="table"
              :show-fields="showFields"
              :available-columns="availableColumns"
              :meta="meta"
              :kanban="kanban"
              :sql-ui="sqlUi"
              :primary-value-column="primaryValueColumn"
              :grouping-field.sync="groupingField"
              :api="api"
              @expandKanbanForm="({rowIdx}) => expandKanbanForm(rowIdx)"
              @insertNewRow="insertNewRow"
              @loadMoreKanbanData="(groupingFieldVal) => loadMoreKanbanData(groupingFieldVal)"
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
              @expandForm="({rowIndex,rowMeta}) => expandRow(rowIndex,rowMeta)"
            />
          </template>
          <template v-else-if="isForm">
            <form-view
              :id="selectedViewId"
              :key="selectedViewId + viewKey"
              :nodes="nodes"
              :table="table"
              :available-columns="availableColumns"
              :meta="meta"
              :data="data"
              :show-fields.sync="showFields"
              :all-columns="allColumns"
              :field-list="fieldList"
              :is-locked="isLocked"
              :db-alias="nodes.dbAlias"
              :api="api"
              :sql-ui="sqlUi"
              :fields-order.sync="fieldsOrder"
              :primary-value-column="primaryValueColumn"
              :form-params.sync="extraViewParams.formParams"
              @onNewColCreation="loadMeta(false)"
            />
          </template>
        </div>
        <template v-if="data && !isForm && !isKanban">
          <pagination
            v-model="page"
            :count="count"
            :size="size"
            @input="loadTableData"
          />
        </template>
      </div>

      <spreadsheet-nav-drawer
        ref="drawer"
        :current-api-url="currentApiUrl"
        :toggle-drawer="toggleDrawer"
        :nodes="nodes"
        :table="table"
        :meta="meta"
        :selected-view-id.sync="selectedViewId"
        :cover-image-field.sync="coverImageField"
        :grouping-field.sync="groupingField"
        :selected-view.sync="selectedView"
        :primary-value-column="primaryValueColumn"
        :concatenated-x-where="concatenatedXWhere"
        :sort="sort"
        :filters.sync="filters"
        :sort-list.sync="sortList"
        :show-fields.sync="showFields"
        :load="loadViews"
        :hide-views="!relation"
        :show-advance-options.sync="showAdvanceOptions"
        :fields-order.sync="fieldsOrder"
        :view-status.sync="viewStatus"
        :columns-width.sync="columnsWidth"
        :show-system-fields.sync="showSystemFields"
        :extra-view-params.sync="extraViewParams"
        @generateNewViewKey="generateNewViewKey"
        @mapFieldsAndShowFields="mapFieldsAndShowFields"
        @loadTableData="loadTableData"
        @showAdditionalFeatOverlay="showAdditionalFeatOverlay($event)"
      >
        <!--        <v-tooltip bottom>
          <template #activator="{on}">
            <v-list-item
              v-on="on"
              @click="showAdditionalFeatOverlay('webhooks')"
            >
              <v-icon x-small class="mr-2 nc-automations">
                mdi-hook
              </v-icon>
              <span class="caption"> Automations</span>
            </v-list-item>
          </template>
          Create Automations or API Webhooks
        </v-tooltip>-->
        <!--        <v-tooltip bottom>
          <template #activator="{on}">
            <v-list-item
              v-on="on"
              @click="showAdditionalFeatOverlay('acl')"
            >
              <v-icon x-small class="mr-2">
                mdi-shield-edit-outline
              </v-icon>
              <span class="caption"> API ACL</span>
            </v-list-item>
          </template>
          Create / Edit API Webhooks
        </v-tooltip>-->
        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('validators')"
        >
          <v-icon x-small class="mr-2">
            mdi-sticker-check-outline
          </v-icon>
          <span class="caption"> API Validators</span>
        </v-list-item>
        <v-divider
          v-if="showAdvanceOptions"
          class="advance-menu-divider"
        />

        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('columns')"
        >
          <v-icon x-small class="mr-2">
            mdi-view-column
          </v-icon>
          <span class="caption font-weight-light">SQL Columns</span>
        </v-list-item>
        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('indexes')"
        >
          <v-icon x-small class="mr-2">
            mdi-blur
          </v-icon>
          <span class="caption font-weight-light">SQL Indexes</span>
        </v-list-item>
        <v-list-item
          v-if="showAdvanceOptions"
          @click="showAdditionalFeatOverlay('triggers')"
        >
          <v-icon x-small class="mr-2">
            mdi-shield-edit-outline
          </v-icon>
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
            <span class="caption">
              <!-- Insert New Row -->
              {{ $t('activity.insertRow') }}
            </span>
          </v-list-item>
          <v-list-item @click="deleteRow">
            <span class="caption">
              <!-- Delete Row -->
              {{ $t('activity.deleteRow') }}
            </span>
          </v-list-item>
          <v-list-item @click="deleteSelectedRows">
            <span class="caption">
              <!-- Delete Selected Rows -->
              {{ $t('activity.deleteSelectedRow') }}
            </span>
          </v-list-item>
        </template>
        <template v-if="rowContextMenu.col && !rowContextMenu.col.rqd && !rowContextMenu.col.virtual">
          <v-tooltip bottom>
            <template #activator="{on}">
              <v-list-item v-on="on" @click="clearCellValue">
                <span class="caption">Clear</span>
              </v-list-item>
            </template>

            <span class="caption">Set column value to <strong>null</strong></span>
          </v-tooltip>
        </template>

        <!--        <template v-if="meta.hasMany && meta.hasMany.length">
          <v-divider v-if="isEditable && !isLocked" />
          <span class="ml-3 grey&#45;&#45;text " style="font-size: 9px">Has Many</span>

          <v-list-item v-for="(hm,i) in meta.hasMany" :key="i" @click="addNewRelationTabCtxMenu(hm,'hm')">
            <span class="caption text-capitalize">{{ hm._tn }}</span>
          </v-list-item>
        </template>

        <template v-if="meta.belongsTo && meta.belongsTo.length">
          <v-divider />
          <span class="ml-3 grey&#45;&#45;text " style="font-size: 9px">Belongs To</span>

          <v-list-item v-for="(bt,i) in belongsTo" :key="i" @click="addNewRelationTabCtxMenu(bt,'bt')">
            <span class="caption text-capitalize">{{ bt._rtn }}</span>
          </v-list-item>
        </template>-->
      </v-list>
    </v-menu>
    <v-dialog
      v-if="data"
      v-model="showExpandModal"
      :overlay-opacity="0.8"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
    >
      <expanded-form
        v-if="isKanban && kanban.selectedExpandRow"
        :key="kanban.selectedExpandRow.id"
        v-model="kanban.selectedExpandRow"
        :db-alias="nodes.dbAlias"
        :has-many="hasMany"
        :belongs-to="belongsTo"
        :table="table"
        :old-row.sync="kanban.selectedExpandOldRow"
        :is-new="kanban.selectedExpandRowMeta.new"
        :selected-row-meta="kanban.selectedExpandRowMeta"
        :meta="meta"
        :sql-ui="sqlUi"
        :primary-value-column="primaryValueColumn"
        :api="api"
        :available-columns="availableColumns"
        :nodes="nodes"
        :query-params="queryParams"
        :show-next-prev="false"
        :preset-values="presetValues"
        @cancel="showExpandModal = false;"
        @input="showExpandModal = false; (kanban.selectedExpandRow && kanban.selectedExpandRow.rowMeta && delete kanban.selectedExpandRow.rowMeta.new) ; loadKanbanData(false)"
        @commented="reloadComments"
        @next="loadNext"
        @prev="loadPrev"
      />
      <expanded-form
        v-if="!isKanban && (selectedExpandRowIndex != null && data[selectedExpandRowIndex])"
        :key="selectedExpandRowIndex"
        v-model="data[selectedExpandRowIndex].row"
        :db-alias="nodes.dbAlias"
        :has-many="hasMany"
        :belongs-to="belongsTo"
        :table="table"
        :old-row.sync="data[selectedExpandRowIndex].oldRow"
        :is-new="data[selectedExpandRowIndex].rowMeta.new"
        :selected-row-meta="selectedExpandRowMeta"
        :meta="meta"
        :sql-ui="sqlUi"
        :primary-value-column="primaryValueColumn"
        :api="api"
        :available-columns="availableColumns"
        :nodes="nodes"
        :query-params="queryParams"
        :show-next-prev="true"
        :preset-values="presetValues"
        @cancel="showExpandModal = false;"
        @input="showExpandModal = false; (data[selectedExpandRowIndex] && data[selectedExpandRowIndex].rowMeta && delete data[selectedExpandRowIndex].rowMeta.new) ; loadTableData()"
        @commented="reloadComments"
        @loadTableData="loadTableData"
        @next="loadNext"
        @prev="loadPrev"
      />
    </v-dialog>
    <additional-features
      v-model="showAddFeatOverlay"
      :selected-view="selectedView"
      :delete-table="deleteTable"
      :nodes="nodes"
      :type="featureType"
      :table="table"
    />
  </v-container>
</template>

<script>

import { mapActions } from 'vuex'
import debounce from 'debounce'
import FormView from './views/formView'
import XcGridView from './views/xcGridView'
import spreadsheet from './mixins/spreadsheet'
import DebugMetas from '@/components/project/spreadsheet/components/debugMetas'

import AdditionalFeatures from '@/components/project/spreadsheet/overlay/additinalFeatures'
import GalleryView from '@/components/project/spreadsheet/views/galleryView'
import CalendarView from '@/components/project/spreadsheet/views/calendarView'
import KanbanView from '@/components/project/spreadsheet/views/kanbanView'
import SortList from '@/components/project/spreadsheet/components/sortListMenu'
import Fields from '@/components/project/spreadsheet/components/fieldsMenu'
import SpreadsheetNavDrawer from '@/components/project/spreadsheet/components/spreadsheetNavDrawer'
import LockMenu from '@/components/project/spreadsheet/components/lockMenu'
import ExpandedForm from '@/components/project/spreadsheet/components/expandedForm'
import Pagination from '@/components/project/spreadsheet/components/pagination'
import { SqlUI } from '~/helpers/sqlUi'
import ColumnFilter from '~/components/project/spreadsheet/components/columnFilterMenu'
import MoreActions from '~/components/project/spreadsheet/components/moreActions'
import ShareViewMenu from '~/components/project/spreadsheet/components/shareViewMenu'

export default {
  name: 'RowsXcDataTable',
  components: {
    ShareViewMenu,
    MoreActions,
    FormView,
    DebugMetas,
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
    ColumnFilter,
    AdditionalFeatures
  },
  mixins: [spreadsheet],
  props: {
    isActive: Boolean,
    tabId: String,
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
    syncDataDebounce: debounce(async function(self) {
      await self.syncData()
    }, 500),
    loadTableDataDeb: debounce(async function(self) {
      await self.loadTableDataFn()
    }, 200),
    viewKey: 0,
    extraViewParams: {},
    debug: false,
    key: 1,
    dataLoaded: false,
    searchQueryVal: '',
    columnsWidth: null,
    viewStatus: {
      type: null
    },
    fieldsOrder: [],
    coverImageField: null,
    groupingField: null,
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
    // size: 25,
    xWhere: '',
    sort: '',

    cellHeight: 'small',

    spreadsheet: null,
    options: {
      allowToolbar: true,
      columnSorting: false
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
      icon: 'mdi-ca rd'
    }],
    rowContextMenu: null,
    presetValues: {},
    kanban: {
      data: [],
      stages: [],
      blocks: [],
      recordCnt: {},
      recordTotalCnt: {},
      groupingColumnItems: [],
      loadingData: true,
      selectedExpandRow: null,
      selectedExpandOldRow: null,
      selectedExpandRowMeta: null
    }
  }),
  watch: {
    isActive(n, o) {
      if (!o && n) {
        this.reload()
      }
    },
    page(p) {
      this.$store.commit('tabs/MutSetTabState', {
        id: this.uniqueId,
        key: 'page',
        val: p
      })
    },
    selectedViewId(id) {
      if (this.tabsState[this.tabId] && this.tabsState[this.tabId].page) {
        this.page = this.tabsState[this.tabId].page || 1
      } else {
        this.page = 1
      }
      // this.$store.commit('tabs/MutSetTabState', {
      //   id: this.tabId,
      //   key: 'selectedViewId',
      //   val: id
      // })
    },
    async groupingField(newVal) {
      this.groupingField = newVal
      if (this.selectedView && this.selectedView.show_as === 'kanban') {
        await this.loadKanbanData()
      }
    }
  },
  async mounted() {
    try {
      if (this.tabsState && this.tabsState[this.uniqueId]) {
        if (this.tabsState[this.uniqueId].page) {
          this.page = this.tabsState[this.uniqueId].page
        }
        // if (this.tabsState[this.tabId].selectedViewId) {
        //   this.selectedViewId = this.tabsState[this.tabId].selectedViewId
        // }
      }

      await this.createTableIfNewTable()
      this.loadingMeta = true
      await this.loadMeta(false)
      this.loadingMeta = false
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
        if (this.selectedView && this.selectedView.show_as === 'kanban') {
          await this.loadKanbanData()
        } else {
          await this.loadTableData()
        }
      }
      // this.mapFieldsAndShowFields()
    } catch (e) {
      console.log(e)
    }
    this.searchField = this.primaryValueColumn
    this.dataLoaded = true
    // await this.loadViews();
  },
  methods: {
    ...mapActions({
      loadTablesFromChildTreeNode: 'project/loadTablesFromChildTreeNode'
    }),
    generateNewViewKey() {
      this.viewKey = Math.random()
    },
    loadNext() {
      this.selectedExpandRowIndex = ++this.selectedExpandRowIndex % this.data.length
    },
    loadPrev() {
      this.selectedExpandRowIndex = --this.selectedExpandRowIndex === -1 ? this.data.length - 1 : this.selectedExpandRowIndex
    },
    checkAndDeleteTable() {
      if (
        !this.meta || (
          (this.meta.hasMany && this.meta.hasMany.length) ||
          (this.meta.manyToMany && this.meta.manyToMany.length) ||
          (this.meta.belongsTo && this.meta.belongsTo.length))
      ) {
        return this.$toast.info('Please delete relations before deleting table.').goAway(3000)
      }
      this.deleteTable('showDialog')
    },
    async reload() {
      this.$store.dispatch('meta/ActLoadMeta', {
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        tn: this.table,
        force: true
      })
      if (this.selectedView && this.selectedView.show_as === 'kanban') {
        await this.loadKanbanData()
      } else {
        await this.loadTableData()
      }
      this.key = Math.random()
    },
    reloadComments() {
      if (this.$refs.ncgridview) {
        this.$refs.ncgridview.xcAuditModelCommentsCount()
      }
    },
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

        if (this.isKanban) {
          queryParams.groupingField = this.groupingField
        }

        this.$set(this.selectedView, 'query_params', JSON.stringify(queryParams))

        if (!this._isUIAllowed('xcVirtualTableUpdate')) {
          return
        }
        await this.sqlOp({ dbAlias: this.nodes.dbAlias }, 'xcVirtualTableUpdate', {
          id: this.selectedViewId,
          query_params: queryParams,
          tn: this.meta.tn,
          view_name: this.$route.query.view
        })
      } catch (e) {
        // this.$toast.error(e.message).goAway(3000);
      }
    },
    showAdditionalFeatOverlay(feat) {
      this.showAddFeatOverlay = true
      this.featureType = feat
    },
    async createTableIfNewTable() {
      if (this.nodes.newTable && !this.nodes.tableCreated) {
        const columns = this.sqlUi.getNewTableColumns().filter(col => this.nodes.newTable.columns.includes(col.cn))
        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          'tableCreate',
          {
            tn: this.nodes.tn,
            _tn: this.nodes._tn,
            columns
          }])
        await this.loadTablesFromChildTreeNode({
          _nodes: {
            ...this.nodes
          }
        })
        // eslint-disable-next-line vue/no-mutating-props
        this.nodes.tableCreated = true
      }

      this.loadViews = true
    },

    comingSoon() {
      this.$toast.info('Coming soon!').goAway(3000)
    },
    addNewRelationTabCtxMenu(obj, type) {
      const rowObj = this.rowContextMenu.row

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
      this.$set(this.data[row].rowMeta, 'changed', this.data[row].rowMeta.changed || {})
      if (this.data[row].rowMeta) {
        this.$set(this.data[row].rowMeta.changed, this.availableColumns[col].cn, true)
      }
    },
    async save() {
      for (let row = 0; row < this.rowLength; row++) {
        const { row: rowObj, rowMeta } = this.data[row]
        if (rowMeta.new) {
          try {
            this.$set(this.data[row], 'saving', true)
            const pks = this.meta.columns.filter((col) => {
              return col.pk
            })
            if (this.meta.columns.every((col) => {
              return !col.ai
            }) && pks.length && pks.every(col => !rowObj[col._cn] && !(col.columnDefault || col.default))) {
              return this.$toast.info('Primary column is empty please provide some value').goAway(3000)
            }
            if (this.meta.columns.some((col) => {
              return !col.ai && col.rqd && (rowObj[col._cn] === undefined || rowObj[col._cn] === null) && !col.default
            })) {
              return
            }

            const insertObj = this.meta.columns.reduce((o, col) => {
              if (!col.ai && (rowObj && rowObj[col._cn]) !== null) {
                o[col._cn] = rowObj && rowObj[col._cn]
              }
              return o
            }, {})

            const insertedData = await this.api.insert(insertObj)

            this.data.splice(row, 1, {
              row: insertedData,
              rowMeta: {},
              oldRow: { ...insertedData }
            })

            /* this.$toast.success(`${insertedData[this.primaryValueColumn] ? `${insertedData[this.primaryValueColumn]}'s r` : 'R'}ow saved successfully.`, {
              position: 'bottom-center'
            }).goAway(3000) */
          } catch (e) {
            if (e.response && e.response.data && e.response.data.msg) {
              this.$toast.error(e.response.data.msg).goAway(3000)
            } else {
              this.$toast.error(`Failed to save row : ${e.message}`).goAway(3000)
            }
          } finally {
            this.$set(this.data[row], 'saving', false)
          }
        }
      }
    },
    // // todo: move debounce to cell since this will skip few update api call
    // onCellValueChangeDebounce: debounce(async function(col, row, column, self) {
    //   await self.onCellValueChangeFn(col, row, column)
    // }, 100),
    // onCellValueChange(col, row, column) {
    //   this.onCellValueChangeFn(col, row, column)
    // },
    async onCellValueChange(col, row, column) {
      if (!this.data[row]) {
        return
      }
      const { row: rowObj, rowMeta, oldRow, saving } = this.data[row]
      if (rowMeta.new) {
        // return if there is no change
        if (oldRow[column._cn] === rowObj[column._cn] || saving) {
          return
        }
        await this.save()
      } else {
        try {
          if (!this.api) {
            return
          }
          // return if there is no change
          if (oldRow[column._cn] === rowObj[column._cn]) {
            return
          }
          const id = this.meta.columns.filter(c => c.pk).map(c => rowObj[c._cn]).join('___')

          if (!id) {
            return this.$toast.info('Update not allowed for table which doesn\'t have primary Key').goAway(3000)
          }
          this.$set(this.data[row], 'saving', true)

          // eslint-disable-next-line promise/param-names
          const newData = await this.api.update(id, {
            [column._cn]: rowObj[column._cn]
          }, { [column._cn]: oldRow[column._cn] })
          this.$set(this.data[row], 'row', { ...rowObj, ...newData })

          this.$set(oldRow, column._cn, rowObj[column._cn])
          /*    this.$toast.success(`${rowObj[this.primaryValueColumn] ? `${rowObj[this.primaryValueColumn]}'s c` : 'C'}olumn '${column.cn}' updated successfully.`, {
            position: 'bottom-center'
          }).goAway(3000) */
        } catch (e) {
          if (e.response && e.response.data && e.response.data.msg) {
            this.$toast.error(e.response.data.msg).goAway(3000)
          } else {
            this.$toast.error(`Failed to update row : ${e.message}`).goAway(3000)
          }
        }

        this.$set(this.data[row], 'saving', false)
      }
    },
    async deleteRow() {
      try {
        const rowObj = this.rowContextMenu.row
        if (!this.rowContextMenu.rowMeta.new) {
          const id = this.meta && this.meta.columns && this.meta.columns.filter(c => c.pk).map(c => rowObj[c._cn]).join('___')

          if (!id) {
            return this.$toast.info('Delete not allowed for table which doesn\'t have primary Key').goAway(3000)
          }

          await this.api.delete(id)
        }
        this.data.splice(this.rowContextMenu.index, 1)
        // this.$toast.success('Deleted row successfully').goAway(3000)
      } catch (e) {
        this.$toast.error(`Failed to delete row : ${e.message}`).goAway(3000)
      }
    },
    async deleteSelectedRows() {
      let row = this.rowLength
      // let success = 0
      while (row--) {
        try {
          const { row: rowObj, rowMeta } = this.data[row]
          if (!rowMeta.selected) {
            continue
          }
          if (!rowMeta.new) {
            const id = this.meta.columns.filter(c => c.pk).map(c => rowObj[c._cn]).join('___')

            if (!id) {
              return this.$toast.info('Delete not allowed for table which doesn\'t have primary Key').goAway(3000)
            }

            await this.api.delete(id)
          }
          this.data.splice(row, 1)
          // success++
        } catch (e) {
          return this.$toast.error(`Failed to delete row : ${e.message}`).goAway(3000)
        }
      }
      // if (success) { this.$toast.success(`Deleted ${success} selected row${success > 1 ? 's' : ''} successfully`).goAway(3000) }
    },

    async clearCellValue() {
      const { col, colIndex, row, index } = this.rowContextMenu
      if (row[col._cn] === null) {
        return
      }
      this.$set(this.data[index].row, col._cn, null)
      await this.onCellValueChange(colIndex, index, col)
    },
    async insertNewRow(atEnd = false, expand = false, presetValues = {}) {
      const isKanban = this.selectedView && this.selectedView.show_as === 'kanban'
      const data = isKanban ? this.kanban.data : this.data
      const focusRow = isKanban ? data.length : (atEnd ? this.rowLength : this.rowContextMenu.index + 1)
      const focusCol = this.availableColumns.findIndex(c => !c.ai)
      data.splice(focusRow, 0, {
        row: this.relationType === 'hm'
          ? {
              ...this.fieldList.reduce((o, f) => ({ ...o, [f]: presetValues[f] ?? null }), {}),
              [this.relation.cn]: this.relationIdValue
            }
          : this.fieldList.reduce((o, f) => ({ ...o, [f]: presetValues[f] ?? null }), {}),
        rowMeta: {
          new: true
        },
        oldRow: {}
      })
      if (data[focusRow].row[this.groupingField] === 'Uncategorized') {
        data[focusRow].row[this.groupingField] = null
      }
      this.selected = { row: focusRow, col: focusCol }
      this.editEnabled = { row: focusRow, col: focusCol }
      this.presetValues = presetValues

      if (expand) {
        if (isKanban) {
          this.expandKanbanForm(-1, data[focusRow])
        } else {
          const { rowMeta } = data[data.length - 1]
          this.expandRow(data.length - 1, rowMeta)
        }
      }
      // this.save()
    },

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
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
    async loadMeta(updateShowFields = true, col, oldCol) {
      // update column name in column meta data
      if (oldCol && col) {
        this.$set(this.columnsWidth, col, this.columnsWidth[oldCol])
        this.$set(this.showFields, col, this.showFields[oldCol])
        const i = (this.fieldsOrder || []).indexOf(oldCol)
        if (i > -1) {
          this.$set(this.fieldsOrder, i, col)
        }
        const s = (this.sortList || []).find(s => s.field === oldCol)
        if (s) {
          this.$set(s, 'field', col)
        }
      }

      // load latest table meta
      const tableMeta = await this.$store.dispatch('meta/ActLoadMeta', {
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        tn: this.table,
        force: true
      })

      // update column visibility
      if (updateShowFields) {
        try {
          const qp = JSON.parse(tableMeta.query_params)
          this.showFields = qp.showFields || this.showFields
          if (col) {
            this.$set(this.showFields, col, true)
          }
        } catch (e) {
        }
      }
    },
    loadTableData() {
      this.loadTableDataDeb(this)
    },
    async loadTableDataFn() {
      this.loadingData = true
      try {
        if (this.api) {
          const { list, count } = await this.api.paginatedList(this.queryParams)
          this.count = count
          this.data = list.map(row => ({
            row,
            oldRow: { ...row },
            rowMeta: {}
          }))
        }
      } catch (e) {
        console.log(e)
      }
      this.loadingData = false
    },
    showRowContextMenu(e, row, rowMeta, index, colIndex, col) {
      if (!this.isEditable) {
        return
      }
      e.preventDefault()
      this.rowContextMenu = false
      this.$nextTick(() => {
        this.rowContextMenu = {
          x: e.clientX,
          y: e.clientY,
          row,
          index,
          rowMeta,
          colIndex,
          col
        }
      })
    },
    expandRow(row, rowMeta) {
      this.showExpandModal = true
      this.selectedExpandRowIndex = row
      this.selectedExpandRowMeta = rowMeta
    },
    async onNewColCreation(col, oldCol) {
      if (this.$refs.drawer) {
        await this.$refs.drawer.loadViews()
        this.$refs.drawer.onViewIdChange(this.selectedViewId)
      }
      await this.loadMeta(true, col, oldCol)
      this.$nextTick(async() => {
        await this.loadTableData()
      })
    },
    onFileDrop(ev) {
      let file
      if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        if (ev.dataTransfer.items.length && ev.dataTransfer.items[0].kind === 'file') {
          file = ev.dataTransfer.items[0].getAsFile()
        }
      } else if (ev.dataTransfer.files.length) {
        file = ev.dataTransfer.files[0]
      }

      if (file && !file.name.endsWith('.csv')) {
        return
      }

      this.$refs.csvExportImport.onCsvFileSelection(file)
    },
    // Kanban
    async loadKanbanData(initKanbanProps = true) {
      try {
        const kanban = {
          data: [],
          stages: [],
          blocks: [],
          recordCnt: {},
          recordTotalCnt: {},
          groupingColumnItems: [],
          loadingData: true,
          selectedExpandRow: null,
          selectedExpandOldRow: null,
          selectedExpandRowMeta: null
        }
        if (initKanbanProps) {
          this.kanban = kanban
        }

        if (this.api) {
          const groupingColumn = this.meta.columns.find(c => c._cn === this.groupingField)

          if (!groupingColumn) {
            return
          }

          const initialLimit = 10
          const uncategorized = 'Uncategorized'

          kanban.groupingColumnItems = groupingColumn.dtxp.split(',').map((c) => {
            const trimCol = c.replace(/'/g, '')
            kanban.recordCnt[trimCol] = 0
            return trimCol
          }).sort()

          kanban.groupingColumnItems.unshift(uncategorized)
          kanban.recordCnt[uncategorized] = 0
          for (const groupingColumnItem of kanban.groupingColumnItems) {
            // enrich Kanban data
            var {
              data
            } = await this.api.get(`/nc/${this.$store.state.project.projectId}/api/v1/${this.$route.query.name}`, {
              limit: initialLimit,
              where: groupingColumnItem === uncategorized ? `(${this.groupingField},is,null)` : `(${this.groupingField},eq,${groupingColumnItem})`
            })
            data.map((d) => {
              // handle composite primary key
              d.c_pk = this.meta.columns.filter(c => c.pk).map(c => d[c._cn]).join('___')
              if (!d.id) {
                // id is required for <kanban-board/>
                d.id = d.c_pk
              }
              kanban.data.push({
                row: d,
                oldRow: d,
                rowMeta: {}
              })
              kanban.recordCnt[groupingColumnItem] += 1
              kanban.blocks.push({
                status: groupingColumnItem,
                ...d
              })
            })
            // enrich recordTotalCnt
            var {
              data
            } = await this.api.get(`/nc/${this.$store.state.project.projectId}/api/v1/${this.$route.query.name}/count`, {
              where: groupingColumnItem === uncategorized ? `(${this.groupingField},is,null)` : `(${this.groupingField},eq,${groupingColumnItem})`
            })
            kanban.recordTotalCnt[groupingColumnItem] = data.count
          }
        }
        this.kanban = kanban
      } catch (e) {
        if (e.response && e.response.data && e.response.data.msg) {
          this.$toast.error(e.response.data.msg, {
            position: 'bottom-center'
          }).goAway(3000)
        } else {
          this.$toast.error(`Error occurred : ${e.message}`, {
            position: 'bottom-center'
          }).goAway(3000)
        }
      } finally {
        this.kanban.loadingData = false
      }
    },
    async loadMoreKanbanData(groupingFieldVal) {
      const uncategorized = 'uncategorized'
      const {
        data
      } = await this.api.get(`/nc/${this.$store.state.project.projectId}/api/v1/${this.$route.query.name}`, {
        limit: 5,
        where: groupingFieldVal === uncategorized ? `(${this.groupingField},is,null)` : `(${this.groupingField},eq,${groupingFieldVal})`,
        offset: this.kanban.recordCnt[groupingFieldVal]
      })
      data.map((d) => {
        // handle composite primary key
        d.c_pk = this.meta.columns.filter(c => c.pk).map(c => d[c._cn]).join('___')
        if (!d.id) {
          // id is required for <kanban-board/>
          d.id = d.c_pk
        }
        this.kanban.data.push({
          row: d,
          oldRow: d,
          rowMeta: {}
        })
        this.kanban.blocks.push({
          status: groupingFieldVal,
          ...d
        })
      })
      this.kanban.recordCnt[groupingFieldVal] += data.length
    },
    expandKanbanForm(rowIdx, data) {
      if (rowIdx != -1) {
        // not a new record -> find the target record
        data = this.kanban.data.filter(o => o.row.c_pk == rowIdx)[0]
      }
      this.showExpandModal = true
      this.kanban.selectedExpandRow = data.row
      this.kanban.selectedExpandOldRow = data.oldRow
      this.kanban.selectedExpandRowMeta = data.rowMeta
    }
  },
  computed: {
    tabsState() {
      return this.$store.state.tabs.tabsState || {}
    },
    uniqueId() {
      return `${this.tabId}_${this.selectedViewId}`
    },
    size() {
      return (this.$store.state.project.projectInfo && this.$store.state.project.projectInfo.defaultLimit) || 25
    },
    isPkAvail() {
      return this.meta && this.meta.columns.some(c => c.pk)
    },
    isGallery() {
      return this.selectedView && this.selectedView.show_as === 'gallery'
    },
    isForm() {
      return this.selectedView && this.selectedView.show_as === 'form'
    },
    isKanban() {
      return this.selectedView && this.selectedView.show_as === 'kanban'
    },
    meta() {
      return this.$store.state.meta.metas[this.table]
    },
    currentApiUrl() {
      return this.api && `${this.api.apiUrl}?` + Object.entries(this.queryParams).filter(p => p[1]).map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`).join('&')
    },
    isEditable() {
      return this._isUIAllowed('xcDatatableEditable')
    },
    sqlUi() {
      return SqlUI.create(this.nodes.dbConnection)
    },
    api() {
      return this.meta && this.$ncApis.get({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        table: this.meta.tn
      })
      // return this.meta && this.meta._tn ? ApiFactory.create(this.$store.getters['project/GtrProjectType'], this.meta && this.meta._tn, this.meta && this.meta.columns, this, this.meta) : null
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

/deep/ .nc-table-toolbar > .v-toolbar__content {
  padding: 0;
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
