<template>
  <v-container class="h-100 j-excel-container pa-0 ma-0" fluid>
    <div v-if="modelName" class="model-name text-capitalize">
      <span class="font-weight-bold"> {{ modelName }}</span> <span class="font-weight-regular ml-1">( Main View )</span>
    </div>

    <v-toolbar height="40" dense class="elevation-0 xc-toolbar xc-border-bottom" style="z-index: 7;border-radius: 4px">
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
              :key="col._cn"
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
      style="overflow:auto;transition: width 500ms "
      class="d-flex"
    >
      <div class="flex-grow-1 h-100" style="overflow-y: auto">
        <div ref="table" style=" overflow: auto;width:100%">
          <v-skeleton-loader v-if="loadingData" type="table" />

          <xc-grid-view
            v-else
            :meta="meta"
            :data="data"
            :available-columns="availableColumns"
            :show-fields="showFields"
            :belongs-to="belongsTo"
            :has-many="hasMany"
            :is-public-view="true"
            :nodes="{dbAlias:''}"
            :sql-ui="sqlUi"
          />
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
    </div>

    <v-dialog v-model="showPasswordModal" width="400">
      <v-card width="400" class="backgroundColor">
        <v-container fluid>
          <v-text-field
            v-model="password"
            dense
            type="password"
            solo
            flat
            hint="Enter the password"
            persistent-hint
          />

          <div class="text-center">
            <v-btn small color="primary" @click="loadTableData(); showPasswordModal =false">
              Unlock
            </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>

import ApiFactory from '@/components/project/spreadsheet/apis/apiFactory'
// import EditableCell from "@/components/project/spreadsheet/editableCell";
import { SqlUI } from '@/helpers/sqlUi'
import FieldsMenu from '@/components/project/spreadsheet/components/fieldsMenu'
import SortListMenu from '@/components/project/spreadsheet/components/sortListMenu'
import ColumnFilterMenu from '@/components/project/spreadsheet/components/columnFilterMenu'
import XcGridView from '@/components/project/spreadsheet/views/xcGridView'
import spreadsheet from '@/components/project/spreadsheet/mixins/spreadsheet'
// import ExpandedForm from "@/components/project/spreadsheet/expandedForm";

export default {
  name: 'XcTable',
  components: { XcGridView, ColumnFilterMenu, SortListMenu, FieldsMenu },
  mixins: [spreadsheet],
  props: {
    dbAlias: String,
    env: String,
    nodes: Object,
    addNewRelationTab: Function,
    relationType: String,
    relation: Object,
    relationIdValue: [String, Number],
    refTable: String,
    relationPrimaryValue: [String, Number]
  },
  data: () => ({
    password: null,
    showPasswordModal: false,
    client: 'mysql',
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
    fieldFilter: '',

    filters: [],
    sortList: [],

    data: [],
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
  computed: {
    availableColumns() {
      let columns
      const hideCols = ['created_at', 'updated_at']

      if (this.showSystemFields) {
        columns = this.meta.columns || []
      } else if (this.data && this.data.length) {
        // c._cn in this.data[0].row &&
        columns = (this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c._cn))) || []
      } else {
        columns = (this.meta && this.meta.columns && this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c._cn))) || []
      }
      return columns
    },
    concatenatedXWhere() {
      let where = ''
      if (this.searchField && this.searchQuery.trim()) {
        if (['text', 'string'].includes(this.sqlUi.getAbstractType(this.meta.columns.find(({ cn }) => cn === this.searchField)))) {
          where = `(${this.searchField},like,%${this.searchQuery.trim()}%)`
        } else {
          where = `(${this.searchField},eq,${this.searchQuery.trim()})`
        }
      }

      if (!where) {
        return this.xWhere
      }

      return this.xWhere ? where + `~and(${this.xWhere})` : where
    },
    sqlUi() {
      // todo: replace with correct client
      return SqlUI.create({ client: this.client })
    },
    queryParams() {
      return {
        limit: this.size,
        offset: this.size * (this.page - 1),
        where: this.concatenatedXWhere,
        sort: this.sort
      }
    },
    api() {
      return ApiFactory.create(this.$store.getters['project/GtrProjectType'], this.table, this.meta && this.meta.columns, this, this.meta)
    },
    colLength() {
      return (this.meta && this.meta.columns && this.meta.columns.length) || 0
    },
    visibleColLength() {
      return (this.meta && this.meta.columns && this.meta.columns.length) || 0
    },
    rowLength() {
      return (this.data && this.data.length) || 0
    },
    edited() {
      return this.data && this.data.some(r => r.rowMeta && (r.rowMeta.new || r.rowMeta.changed))
    },
    hasMany() {
      return this.meta && this.meta.hasMany
        ? this.meta.hasMany.reduce((hm, o) => {
          hm[o.rcn] = hm[o.rcn] || []
          hm[o.rcn].push(o)
          return hm
        }, {})
        : {}
    },
    belongsTo() {
      return this.meta && this.meta.belongsTo
        ? this.meta.belongsTo.reduce((bt, o) => {
          bt[o._cn] = o
          return bt
        }, {})
        : {}
    },
    table() {
      if (this.relationType === 'hm') {
        return this.relation.tn
      } else if (this.relationType === 'bt') {
        return this.relation.rtn
      }

      return this.nodes.tn || this.nodes.view_name
    },
    primaryValueColumn() {
      if (!this.meta || !this.meta.columns) {
        return ''
      }

      const pkIndex = this.meta.columns.findIndex(c => c.pk)

      if (pkIndex > -1 && pkIndex <= this.colLength - 1) {
        return this.meta.columns[pkIndex + 1]._cn
      }
      return this.meta.columns[0]._cn
    }
  },
  async mounted() {
    try {
      // await this.loadMeta();
      await this.loadTableData()
      // const {list, count} = await this.api.paginatedList(this.queryParams);
      // this.count = count;
      // this.data = list.map(row => ({
      //   row,
      //   oldRow: {...row},
      //   rowMeta: {}
      // }));
    } catch (e) {
      console.log(e)
    }
    if (this.data.length) {
      // eslint-disable-next-line no-unused-vars
      const options = {
        ...this.options,
        columns: [...this.meta.columns.map((col) => {
          return {
            readOnly: col.ai,
            type: typeof this.data[0][col._cn],
            title: col._cn,
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
    /*    if (this.relationType === 'hm') {
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
    } */
    document.addEventListener('keydown', this.onKeyDown)
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
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
    addSort() {
      this.sortList.push({
        field: '',
        order: ''
      })
      this.filters = this.filters.slice()
    },
    async loadTableData() {
      this.loadingData = true
      try {
        // eslint-disable-next-line camelcase
        const { data: list, count, meta, model_name, client } = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          query: this.queryParams
        }, 'getSharedViewData', {
          view_id: this.$route.params.id,
          password: this.password
        }])
        this.client = client
        this.meta = meta
        // eslint-disable-next-line camelcase
        this.modelName = model_name

        this.fieldList = this.meta.columns.map(c => c._cn)

        // const {list, count} = await thi(this.queryParams);
        this.count = count
        this.data = list.map(row => ({
          row,
          oldRow: { ...row },
          rowMeta: {}
        }))

        this.showFields = this.fieldList.reduce((obj, k) => {
          obj[k] = true
          return obj
        }, {})
      } catch (e) {
        this.showPasswordModal = true
      }

      this.loadingData = false
    },
    onKeyDown(e) {
      if (this.selected.col === null || this.selected.row === null) {
        return
      }
      switch (e.keyCode) {
        // left
        case 37:
          if (this.selected.col > 0) {
            this.selected.col--
          }
          break
        // right
        case 39:
          if (this.selected.col < this.colLength - 1) {
            this.selected.col++
          }
          break
        // up
        case 38:
          if (this.selected.row > 0) {
            this.selected.row--
          }
          break
        // down
        case 40:
          if (this.selected.row < this.rowLength - 1) {
            this.selected.row++
          }
          break
        // enter
        case 13:
          this.makeEditable(this.selected.col, this.selected.row)
          break
      }
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
      this.showExpandModal = true
      this.selectedExpandRowIndex = row
      this.selectedExpandRowMeta = rowMeta
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
