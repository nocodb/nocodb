<template>
  <div>
    <table
      v-if="data"
      class="xc-row-table nc-grid"
      style=" "
    >
      <thead>
        <tr class="text-left nc-grid-header-row">
          <th
            class="grey-border caption"
            :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4 grey--text text--darken-2'"
            style="width: 65px"
          >
            #
          </th>
          <th
            v-for="(col) in availableColumns"
            v-show="showFields[col.alias]"
            :key="col.alias"
            v-xc-ver-resize
            class="grey-border caption font-wight-regular  nc-grid-header-cell"
            :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4  grey--text text--darken-2'"
            :data-col="col.alias"
            @xcresize="onresize(col.alias,$event)"
            @xcresizing="onXcResizing(col.alias,$event)"
            @xcresized="resizingCol = null"
          >
            <!--            :style="columnsWidth[col._cn]  ? `min-width:${columnsWidth[col._cn]}; max-width:${columnsWidth[col._cn]}` : ''"
-->

            <virtual-header-cell
              v-if="col.virtual"
              :column="col"
              :nodes="nodes"
              :meta="meta"
              :sql-ui="sqlUi"
              :is-public-view="isPublicView"
              @saved="onNewColCreation"
            />

            <header-cell
              v-else
              :is-public-view="isPublicView"
              :nodes="nodes"
              :value="col._cn"
              :sql-ui="sqlUi"
              :meta="meta"
              :column-index="meta && meta.columns && meta.columns.indexOf(col)"
              :is-foreign-key="col._cn in belongsTo || col._cn in hasMany"
              :column="col"
              :is-virtual="isVirtual"
              @onRelationDelete="$emit('onRelationDelete')"
              @saved="onNewColCreation"
            />
          </th>

          <th
            v-if="!isLocked && !isVirtual && !isPublicView && _isUIAllowed('add-column')"
            :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4  grey--text text--darken-2'"
            class="grey-border new-column-header pointer  nc-grid-header-cell"
            @click="addNewColMenu = true"
          >
            <v-menu
              v-model="addNewColMenu"
              offset-y
              z-index="99"
              left
              content-class="elevation-0"
            >
              <template #activator="{on}">
                <v-icon small v-on="on">
                  mdi-plus
                </v-icon>
              </template>
              <edit-column
                v-if="addNewColMenu"
                :meta="meta"
                :nodes="nodes"
                :sql-ui="sqlUi"
                @close="addNewColMenu = false"
                @saved="onNewColCreation"
              />
            </v-menu>
          </th>
        </tr>
      </thead>
      <tbody v-click-outside="onClickOutside">
        <tr
          v-for="({row:rowObj, rowMeta},row) in data"
          :key="row"
          class=" nc-grid-row"
        >
          <td
            style="width: 65px"
            class="caption nc-grid-cell"
            @contextmenu="showRowContextMenu($event,rowObj,rowMeta,row)"
          >
            <div class="d-flex align-center">
              <span
                v-show="!rowMeta || !rowMeta.selected"
                class="ml-2 grey--text"
                :class="{ 'row-no' : !isPublicView }"
              >{{ row + 1 }}</span>
              <template v-if="!isPublicView">
                <v-checkbox
                  v-if="rowMeta"
                  v-model="rowMeta.selected"
                  class="row-checkbox pt-0 align-self-center my-auto"
                  :class="{active : rowMeta.selected}"
                  dense
                />
                <v-spacer />
                <v-icon
                  v-if="!groupedAggCount[ids[row]]"
                  color="pink"
                  small
                  class="row-expand-icon mr-1 pointer"
                  @click="expandRow(row,rowMeta)"
                >
                  mdi-arrow-expand
                </v-icon>
              </template>
              <v-chip
                v-if="groupedAggCount[ids[row]]"
                x-small
                :color="colors[ groupedAggCount[ids[row]] % colors.length]"
                @click="expandRow(row,rowMeta)"
              >
                {{ groupedAggCount[ids[row]] }}
              </v-chip>
            </div>
          </td>
          <td
            v-for="(columnObj,col) in availableColumns"
            v-show="showFields[columnObj.alias]"
            :key="row + columnObj.alias"
            class="cell pointer nc-grid-cell"
            :class="{
              'active' :!isPublicView && selected.col === col && selected.row === row && isEditable ,
              'primary-column' : primaryValueColumn === columnObj._cn,
              'text-center': isCentrallyAligned(columnObj),
              'required': isRequired(columnObj,rowObj)
            }"
            :data-col="columnObj.alias"
            @dblclick="makeEditable(col,row,columnObj.ai,rowMeta)"
            @click="makeSelected(col,row);"
            @contextmenu="showRowContextMenu($event,rowObj,rowMeta,row,col, columnObj)"
          >
            <virtual-cell
              v-if="columnObj.virtual"
              :column="columnObj"
              :row="rowObj"
              :nodes="nodes"
              :meta="meta"
              :api="api"
              :active="selected.col === col && selected.row === row"
              :sql-ui="sqlUi"
              :is-new="rowMeta.new"
              v-on="$listeners"
              @updateCol="(...args) => updateCol(...args, columnObj.bt && meta.columns.find( c => c.cn === columnObj.bt.cn), col, row)"
            />

            <editable-cell
              v-else-if="
                (isPkAvail ||rowMeta.new) &&
                  !isLocked
                  && !isPublicView
                  && (editEnabled.col === col && editEnabled.row === row)
                  || enableEditable(columnObj)
              "
              v-model="rowObj[columnObj._cn]"
              :column="columnObj"
              :meta="meta"
              :active="selected.col === col && selected.row === row"
              :sql-ui="sqlUi"
              :db-alias="nodes.dbAlias"
              @save="editEnabled = {}"
              @cancel="editEnabled = {}"
              @update="onCellValueChange(col, row, columnObj)"
              @blur="onCellValueChange(col, row, columnObj,'blur')"
              @change="onCellValueChange(col, row, columnObj)"
            />

            <table-cell
              v-else
              :class="{'primary--text' : primaryValueColumn === columnObj._cn}"
              :selected="selected.col === col && selected.row === row"
              :is-locked="isLocked"
              :column="columnObj"
              :meta="meta"
              :db-alias="nodes.dbAlias"
              :value="rowObj[columnObj._cn]"
              :sql-ui="sqlUi"
              @enableedit="makeSelected(col,row);makeEditable(col,row,columnObj.ai, rowMeta)"
            />
          </td>
        </tr>
        <tr v-if="isPkAvail && !isLocked && !isPublicView && isEditable && relationType !== 'bt'">
          <td :colspan="visibleColLength + 1" class="text-left pointer nc-grid-add-new-cell" @click="insertNewRow(true)">
            <v-tooltip top>
              <template #activator="{on}">
                <v-icon small color="pink" v-on="on">
                  mdi-plus
                </v-icon>
                <span class="ml-1 caption grey--text ">New Row</span>
              </template>
              <span class="caption"> Add new row</span>
            </v-tooltip>
          </td>
        </tr>
      </tbody>
    </table>

    <div is="style" v-html="style" />
    <!--    <div is="style" v-html="resizeColStyle" />-->
    <dynamic-style>
      <template v-if="resizingCol">
        [data-col="{{ resizingCol }}"]{min-width:{{ resizingColWidth }};max-width:{{
          resizingColWidth
        }};width:{{ resizingColWidth }};}
      </template>
    </dynamic-style>
  </div>
</template>

<script>
import DynamicStyle from '@/components/dynamicStyle'
import HeaderCell from '@/components/project/spreadsheet/components/headerCell'
import EditableCell from '@/components/project/spreadsheet/components/editableCell'
import EditColumn from '@/components/project/spreadsheet/components/editColumn'
import TableCell from '@/components/project/spreadsheet/components/cell'
import colors from '@/mixins/colors'
import columnStyling from '@/components/project/spreadsheet/helpers/columnStyling'
import VirtualCell from '@/components/project/spreadsheet/components/virtualCell'
import VirtualHeaderCell from '@/components/project/spreadsheet/components/virtualHeaderCell'

export default {
  name: 'XcGridView',
  components: {
    DynamicStyle,
    VirtualHeaderCell,
    VirtualCell,
    TableCell,
    EditColumn,
    EditableCell,
    HeaderCell
  },
  mixins: [colors],
  props: {
    relationType: String,
    availableColumns: [Object, Array],
    showFields: Object,
    sqlUi: [Object, Function],
    api: [Object, Function],
    isEditable: Boolean,
    nodes: Object,
    primaryValueColumn: String,
    belongsTo: [Object, Array],
    hasMany: [Object, Array],
    data: [Array, Object],
    meta: Object,
    visibleColLength: [Number, String],
    isPublicView: Boolean,
    table: String,
    isVirtual: Boolean,
    isLocked: Boolean,
    columnsWidth: { type: Object },
    isPkAvail: Boolean
  },
  data: () => ({
    resizingCol: null,
    resizingColWidth: null,
    selectedExpandRowIndex: null,
    selectedExpandRowMeta: null,
    addNewColMenu: false,
    selected: {
      row: null,
      col: null
    },
    editEnabled: {
      row: null,
      col: null
    },
    aggCount: []
  }),
  computed: {
    ids() {
      return this.data.map(({ oldRow }) => this.meta.columns.filter(c => c.pk).map(c => oldRow[c._cn]).join('___'))
    },
    haveHasManyrelation() {
      return !!Object.keys(this.hasMany).length
    },
    colLength() {
      return (this.availableColumns && this.availableColumns.length) || 0
    },
    rowLength() {
      return (this.data && this.data.length) || 0
    },
    availColNames() {
      return (this.availableColumns && this.availableColumns.map(c => c._cn)) || []
    },
    groupedAggCount() {
      // eslint-disable-next-line camelcase
      return this.aggCount ? this.aggCount.reduce((o, { model_id, count }) => ({ ...o, [model_id]: count }), {}) : {}
    },
    style() {
      let style = ''
      for (const c of this.availableColumns) {
        const val = (this.columnsWidth && this.columnsWidth[c.alias]) || (c.virtual ? '200px' : (columnStyling[c.uidt] && columnStyling[c.uidt].w))
        if (val && c.key !== this.resizingCol) {
          style += `[data-col="${c.alias}"]{min-width:${val};max-width:${val};width: ${val};}`
        }
      }

      return style
    }
    // resizeColStyle() {
    //   return this.resizingCol ? ` [data-col="${this.resizingCol}"]{min-width:${this.resizingColWidth};max-width:${this.resizingColWidth};width:${this.resizingColWidth};}` : ''
    // }
  },
  watch: {
    data() {
      this.xcAuditModelCommentsCount()
    }
  },
  mounted() {
    this.calculateColumnWidth()
  },
  created() {
    document.addEventListener('keydown', this.onKeyDown)
    this.xcAuditModelCommentsCount()
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    isRequired(_columnObj, rowObj) {
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.cn === columnObj.bt.cn)
      }

      return columnObj && (columnObj.rqd &&
        (rowObj[columnObj._cn] === undefined || rowObj[columnObj._cn] === null) &&
        !columnObj.default)
    },
    updateCol(row, column, value, columnObj, colIndex, rowIndex) {
      this.$set(row, column, value)
      this.onCellValueChange(colIndex, rowIndex, columnObj)
    },
    calculateColumnWidth() {
      // setTimeout(() => {
      //   const obj = {}
      //   this.meta && this.meta.columns && this.meta.columns.forEach((c) => {
      //     obj[c._cn] = (columnStyling[c.uidt] && columnStyling[c.uidt].w) || undefined
      //   })
      //   this.meta && this.meta.v && this.meta.v.forEach((v) => {
      //     obj[v._cn] = v.bt ? '100px' : '200px'
      //   })
      //   Array.from(this.$el.querySelectorAll('th')).forEach((el) => {
      //     const width = el.getBoundingClientRect().width
      //     obj[el.dataset.col] = obj[el.dataset.col] || ((width < 100 ? 100 : width) + 'px')
      //   })
      //   this.$emit('update:columnsWidth', { ...obj, ...(this.columnWidth || {}) })
      // }, 2000)
    },
    isCentrallyAligned(col) {
      return !['SingleLineText',
        'LongText',
        'Attachment',
        'Date',
        'Time',
        'Email',
        'URL',
        'DateTime',
        'CreateTime',
        'LastModifiedTime'].includes(col.uidt)
    },
    async xcAuditModelCommentsCount() {
      if (this.isPublicView || !this.data || !this.data.length) {
        return
      }
      const aggCount = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        dbAlias: this.nodes.dbAlias
      }, 'xcAuditModelCommentsCount', {
        model_name: this.meta._tn,
        ids: this.data.map(({ row: r }) => {
          return this.meta.columns.filter(c => c.pk).map(c => r[c._cn]).join('___')
        })
      }])

      this.aggCount = aggCount
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
        default: {
          if (this.editEnabled.col != null && this.editEnabled.row != null) {
            return
          }
          if (e.key && e.key.length === 1) {
            if (!this.isPkAvail && !this.data[this.selected.row].rowMeta.new) {
              return this.$toast.info('Update not allowed for table which doesn\'t have primary Key').goAway(3000)
            }

            this.$set(this.data[this.selected.row].row, this.availableColumns[this.selected.col]._cn, '')
            this.editEnabled = { ...this.selected }
          }
        }
      }
    },
    onClickOutside() {
      if (
        this.meta.columns &&
        this.meta.columns[this.selected.col] &&
        this.meta.columns[this.selected.col].virtual
      ) {
        return
      }
      this.selected.col = null
      this.selected.row = null
    },
    onNewColCreation(col) {
      this.addNewColMenu = false
      this.addNewColModal = false
      this.$emit('onNewColCreation', col)
    },
    expandRow(...args) {
      this.$emit('expandRow', ...args)
    },
    showRowContextMenu($event, rowObj, rowMeta, row, ...rest) {
      this.$emit('showRowContextMenu', $event, rowObj, rowMeta, row, ...rest)
    },
    onCellValueChange(col, row, column, ev) {
      this.$emit('onCellValueChange', col, row, column, ev)
    },
    addNewRelationTab(...args) {
      this.$emit('addNewRelationTab', ...args)
    },
    makeSelected(col, row) {
      if (this.selected.col !== col || this.selected.row !== row) {
        this.selected = { col, row }
        this.editEnabled = {}
      }
    },
    makeEditable(col, row, _, rowMeta) {
      if (this.isPublicView || !this.isEditable) {
        return
      }

      if (!this.isPkAvail && !rowMeta.new) {
        return this.$toast.info('Update not allowed for table which doesn\'t have primary Key').goAway(3000)
      }
      if (this.availableColumns[col].ai) {
        return this.$toast.info('Auto Increment field is not editable').goAway(3000)
      }
      if (this.availableColumns[col].pk && !this.data[row].rowMeta.new) {
        return this.$toast.info('Editing primary key not supported').goAway(3000)
      }
      if (this.editEnabled.col !== col || this.editEnabled.row !== row) {
        this.editEnabled = { col, row }
      }
    },
    enableEditable(column) {
      return (column && column.uidt === 'Attachment') ||
        (column && column.uidt === 'SingleSelect') ||
        (column && column.uidt === 'MultiSelect') ||
        (column && column.uidt === 'DateTime') ||
        (column && column.uidt === 'Date') ||
        (column && column.uidt === 'Time') ||
        (this.sqlUi && this.sqlUi.getAbstractType(column) === 'boolean')
    },
    insertNewRow(atEnd = false, expand = false) {
      this.$emit('insertNewRow', atEnd, expand)
    },
    onresize(col, size) {
      this.$emit('update:columnsWidth', { ...this.columnsWidth, [col]: size })
    },
    onXcResizing(_cn, width) {
      this.resizingCol = _cn
      this.resizingColWidth = width
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .resizer:hover, .resizer:active, .resizer:focus {
    background: var(--v-primary-base);
    cursor: col-resize;
  }

  .v-list-item--dense .v-list-item__icon, .v-list--dense .v-list-item .v-list-item__icon {
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .v-list-item--dense, .v-list--dense .v-list-item {
    min-height: 32px;
  }

  .v-input__control .v-input__slot .v-input--selection-controls__input {
    transform: scale(.85);
    margin-right: 0;
  }

  .xc-toolbar .v-input__slot, .navigation .v-input__slot {
    box-shadow: none !important;
  }

  .navigation .v-input__slot input::placeholder {
    font-size: .8rem;
  }

  .v-btn {
    text-transform: capitalize;
  }

  .row-checkbox .v-input__control {
    height: 24px !important;
  }

  tr:hover .xc-bt-chip {
    margin-right: 0;
    padding-right: 0 !important;
  }

  .xc-bt-chip {
    margin-right: 24px;
    transition: .4s margin-right, .4s padding-right;
  }

  .theme--light tbody tr:hover {
    background: #eeeeee22;
  }

  .theme--dark tbody tr:hover {
    background: #33333322;
  }

  .xc-border.search-box {
    overflow: visible;
    border-radius: 4px;
  }

  .xc-border.search-box .v-input {
    transition: .4s border-color;
  }

  .xc-border.search-box .v-input--is-focused {
    border: 1px solid var(--v-primary-base) !important;
    margin: -1px;
  }

  .search-field.v-text-field.v-text-field--solo.v-input--dense > .v-input__control {
    min-height: auto;
  }

  .view .view-icon {
    display: none;
    transition: .3s display;
  }

  .view:hover .view-icon {
    display: inline-block;
  }

  .view:hover .check-icon {
    display: none;
  }

  .v-input__control label {
    font-size: inherit;
  }

}

table, td, th.grey-border, th.grey.darken-3, th.grey.lighten-4 {
  border-right: 1px solid #7f828b33 !important;
  border-left: 1px solid #7f828b33 !important;
  border-bottom: 2px solid #7f828b33 !important;
  border-top: 2px solid #7f828b33 !important;
  border-collapse: collapse;
}

td, th {
  position: relative;
  padding: 0 5px !important;
}

td.active::after, td.active::before {
  content: '';
  position: absolute;
  z-index: 3;
  height: calc(100% + 2px);
  width: calc(100% + 2px);
  left: -1px;
  top: -1px;
  pointer-events: none;
}

td.active::after {
  border: 2px solid var(--v-primary-lighten1);
}

td.active::before {
  background: var(--v-primary-base);
  opacity: .1;
}

.xc-row-table thead tr {
  background: transparent;
}

.xc-row-table thead th {
  /*background: ;*/
  position: sticky;
  top: 0;
  //left: 0;
  z-index: 6;
}

.row-expand-icon, .row-checkbox {
  opacity: 0;
}

tr:hover .row-expand-icon, tr:hover .row-checkbox, tr .row-checkbox.active {
  opacity: 1;
}

tr:hover .row-no {
  display: none;
}

td, tr {
  min-height: 31px !important;
  /*height: 31px !important;*/
  /*max-height: 31px !important;*/
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

.belongsto-col {
  text-decoration: underline;
}

.belongsto-col:hover {
  color: var(--v-primary-base);
}

.hasmany-col-menu-icon {
  opacity: 0;
  transition: .4s opacity, .4s max-width;
}

.hasmany-col-menu-icon.pv {
  /*display: none ;*/
  max-width: 0;
  overflow: hidden;
}

tr:hover .hasmany-col-menu-icon {
  opacity: 1;
  /*display: inline-block;*/
  max-width: 24px;
}

tbody tr:nth-of-type(odd) {
  background-color: transparent;
}

tbody tr:hover {
  background-color: #dddddd33 !important;
}

.views-navigation-drawer {
  transition: .4s max-width, .4s min-width;
}

.cell {
  font-size: 13px;

  &.required {
    box-shadow: inset 0 0 0 1px red;
  }
}

th::before {
  content: '';
  position: absolute;
  width: 100%;
  background: inherit;
  top: -2px;
  height: 3px;
  left: 0;
}

td.primary-column {
  border-right-width: 2px !important;
}

.share-link-box {
  position: relative;
  z-index: 2;
}

.share-link-box::before {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: var(--v-primary-base);
  opacity: .2;
  content: "";
  z-index: 1;
  pointer-events: none;
}

.new-column-header:hover {
  background: linear-gradient(#ffffff33, #ffffff33);
}

.new-column-header {
  text-align: center;
  min-width: 70px;
}

.advance-menu-divider {
  width: calc(100% - 26px);
  margin-left: 13px;
  border-style: dashed;
  margin-top: 5px;
  margin-bottom: 5px;

}

.sort-grid {
  display: grid;
  grid-template-columns:22px auto 100px;
  column-gap: 6px;
  row-gap: 6px;
}

.xc-row-table {
  table-layout: fixed
}

td {
  overflow: hidden;
}

th:first-child, td:first-child {
  min-width: 100px;
}

.has-many-icon {
  transform: rotate(90deg);
}

</style>
