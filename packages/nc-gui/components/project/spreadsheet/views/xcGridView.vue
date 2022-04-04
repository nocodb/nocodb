<template>
  <div
    @dragover.prevent="dragOver = true"
    @dragenter.prevent="dragOver = true"
    @dragexit="dragOver = false"
    @dragleave="dragOver = false"
    @dragend="dragOver = false"
    @drop.prevent.stop="onFileDrop"
  >
    <table
      v-if="data"
      class="xc-row-table nc-grid backgroundColorDefault"
      style=" "
    >
      <thead>
        <tr class="text-left nc-grid-header-row">
          <th
            class="grey-border caption"
            :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4 grey--text text--darken-2'"
            style="width: 65px"
          >
            <div class="d-flex align-center">
              <span v-if="!selectAll" class="row-no">#</span>
              <template v-if="!isPublicView">
                <v-checkbox
                  v-model="selectAll"
                  class="row-checkbox pt-0 align-self-center my-auto"
                  :class="{active : selectAll}"
                  dense
                />
              </template>
              <div class="d-flex align-center" />
            </div>
          </th>
          <th
            v-for="(col) in availableColumns"
            v-show="showFields[col.alias]"
            :key="col.alias"
            v-xc-ver-resize
            class="grey-border caption font-wight-regular  nc-grid-header-cell"
            :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4  grey--text text--darken-2'"
            :data-col="col.alias"
            @xcresize="onresize(col.id,$event), log('xcresize')"
            @xcresizing="onXcResizing(col.alias,$event)"
            @xcresized="resizingCol = null"
          >
            <!--            :style="columnsWidth[col.title]  ? `min-width:${columnsWidth[col.title]}; max-width:${columnsWidth[col.title]}` : ''"
-->

            <virtual-header-cell
              v-if="isVirtualCol(col)"
              :column="col"
              :nodes="nodes"
              :meta="meta"
              :sql-ui="sqlUi"
              :is-public-view="isPublicView"
              :is-locked="isLocked"
              :is-virtual="isVirtual"
              @saved="onNewColCreation"
            />

            <header-cell
              v-else
              :is-public-view="isPublicView"
              :nodes="nodes"
              :value="col.title"
              :sql-ui="sqlUi"
              :meta="meta"
              :column-index="meta && meta.columns && meta.columns.indexOf(col)"
              :column="col"
              :is-virtual="isVirtual"
              :is-locked="isLocked"
              @onRelationDelete="$emit('onRelationDelete')"
              @colDelete="$emit('colDelete')"
              @saved="onNewColCreation"
            />
          </th>

          <th
            v-if="!isLocked && !isVirtual && !isPublicView && _isUIAllowed('add-column')"
            v-t="['column:add']"
            :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4  grey--text text--darken-2'"
            class="grey-border new-column-header pointer  nc-grid-header-cell"
            @click="addNewColMenu = true"
          >
            <v-icon
              small
              @click="addNewColMenu = true"
            >
              mdi-plus
            </v-icon>
            <v-menu
              v-model="addNewColMenu"
              offset-y
              content-class=""
              left
            >
              <template #activator="{on}">
                <span v-on="on" />
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
          v-for="({row:rowObj, rowMeta, saving},row) in data"
          :key="row"
          class=" nc-grid-row"
          :class="{
            'nc-new-row':rowMeta.new,
            'nc-saved-row':!rowMeta.new,
          }"
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
                  v-if="!groupedAggCount[ids[row]] && !isLocked && !saving"
                  color="pink"
                  small
                  class="row-expand-icon nc-row-expand-icon  mr-1 pointer"
                  @click="expandRow(row,rowMeta)"
                >
                  mdi-arrow-expand
                </v-icon>
              </template>
              <v-chip
                v-if="groupedAggCount[ids[row]] && !saving"
                x-small
                :color="colors[ groupedAggCount[ids[row]] % colors.length]"
                @click="expandRow(row,rowMeta)"
              >
                {{ groupedAggCount[ids[row]] }}
              </v-chip>

              <template v-if="saving">
                <v-spacer />
                <v-icon small>
                  mdi-spin mdi-loading
                </v-icon>
              </template>
            </div>
          </td>
          <td
            v-for="(columnObj,col) in availableColumns"
            v-show="showFields[columnObj.alias]"
            :key="row + columnObj.alias"
            class="cell pointer nc-grid-cell"
            :class="{
              'active' :!isPublicView && selected.col === col && selected.row === row && isEditable ,
              'primary-column' : primaryValueColumn === columnObj.title,
              'text-center': isCentrallyAligned(columnObj),
              'required': isRequired(columnObj,rowObj)
            }"
            :data-col="columnObj.alias"
            @dblclick="makeEditable(col,row,columnObj.ai,rowMeta)"
            @click="makeSelected(col,row);"
            @contextmenu="showRowContextMenu($event,rowObj,rowMeta,row,col, columnObj)"
          >
            <virtual-cell
              v-if="isVirtualCol(columnObj)"
              :password="password"
              :is-public="isPublicView"
              :metas="metas"
              :is-locked="isLocked "
              :column="columnObj"
              :row="rowObj"
              :nodes="nodes"
              :meta="meta"
              :api="api"
              :active="selected.col === col && selected.row === row"
              :sql-ui="sqlUi"
              :is-new="rowMeta.new"
              v-on="$listeners"
              @updateCol="(...args) => updateCol(...args, columnObj.bt && meta.columns.find( c => c.column_name === columnObj.bt.column_name), col, row)"
              @saveRow="onCellValueChange(col, row, columnObj, true)"
            />

            <editable-cell
              v-else-if="
                (isPkAvail ||rowMeta.new) &&
                  !isView &&
                  !isLocked
                  && !isPublicView
                  && (editEnabled.col === col && editEnabled.row === row)
                  || enableEditable(columnObj)
              "
              v-model="rowObj[columnObj.title]"
              :column="columnObj"
              :meta="meta"
              :active="selected.col === col && selected.row === row"
              :sql-ui="sqlUi"
              :db-alias="nodes.dbAlias"
              :is-locked="isLocked"
              :is-public="isPublicView"
              :view-id="viewId"
              @save="editEnabled = {};"
              @cancel="editEnabled = {};"
              @update="onCellValueChange(col, row, columnObj, false)"
              @blur="onCellValueChange(col, row, columnObj, true)"
              @navigateToNext="navigateToNext"
              @navigateToPrev="navigateToPrev"
            />

            <table-cell
              v-else
              :class="{'primary--text' : primaryValueColumn === columnObj.title}"
              :selected="selected.col === col && selected.row === row"
              :is-locked="isLocked"
              :column="columnObj"
              :meta="meta"
              :db-alias="nodes.dbAlias"
              :value="rowObj[columnObj.title]"
              :sql-ui="sqlUi"
              @enableedit="makeSelected(col,row);makeEditable(col,row,columnObj.ai, rowMeta)"
            />
          </td>
        </tr>
        <tr v-if="!isView && !isLocked && !isPublicView && isEditable && relationType !== 'bt'">
          <td v-t="['record:add:trigger']" :colspan="visibleColLength + 1" class="text-left pointer nc-grid-add-new-cell" @click="insertNewRow(true)">
            <v-tooltip top>
              <template #activator="{on}">
                <v-icon small color="pink" v-on="on">
                  mdi-plus
                </v-icon>
                <span class="ml-1 caption grey--text ">
                  {{ $t('activity.addRow') }}
                </span>
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
import { isVirtualCol } from 'nocodb-sdk'
import HeaderCell from '../components/headerCell'
import EditableCell from '../components/editableCell'
import EditColumn from '../components/editColumn'
// import columnStyling from '../helpers/columnStyling'
import VirtualCell from '../components/virtualCell'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import colors from '@/mixins/colors'
import TableCell from '@/components/project/spreadsheet/components/cell'
import DynamicStyle from '@/components/dynamicStyle'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'
import { copyTextToClipboard } from '~/helpers/xutils'

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
    loading: Boolean,
    droppable: Boolean,
    isView: Boolean,
    metas: Object,
    relationType: String,
    availableColumns: [Object, Array],
    showFields: Object,
    sqlUi: [Object, Function],
    api: [Object, Function],
    isEditable: Boolean,
    nodes: Object,
    primaryValueColumn: String,
    // belongsTo: [Object, Array],
    // hasMany: [Object, Array],
    data: [Array, Object],
    meta: Object,
    visibleColLength: [Number, String],
    isPublicView: Boolean,
    table: String,
    isVirtual: Boolean,
    isLocked: Boolean,
    // columnsWidth: { type: Object },
    isPkAvail: Boolean,
    password: String,
    viewId: String
  },
  data: () => ({
    resizingCol: null,
    isVirtualCol,
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
    aggCount: [],
    dragOver: false,
    gridViewCols: {}
  }),
  computed: {
    selectAll: {
      get() {
        return !!(this.data.length && this.data.every(d => d.rowMeta && d.rowMeta.selected))
      },
      set(v) {
        for (const d of this.data) {
          this.$set(d.rowMeta, 'selected', v)
        }
      }
    },
    ids() {
      return (this.meta &&
        this.meta.columns &&
        this.data &&
        this.data.map(({ oldRow }) => this.meta.columns.filter(c => c.pk).map(c => oldRow[c.title]).join('___'))) || []
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
      return (this.availableColumns && this.availableColumns.map(c => c.title)) || []
    },
    groupedAggCount() {
      // eslint-disable-next-line camelcase
      return this.aggCount
        ? this.aggCount.reduce((o, {
          row_id,
          count
        }) => ({
          ...o,
          [row_id]: count
        }), {})
        : {}
    },
    style() {
      let style = ''
      for (const c of this.availableColumns) {
        const val = (this.gridViewCols && this.gridViewCols[c.id] && this.gridViewCols[c.id].width) || '200px'

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
    },
    viewId(v, o) {
      if (v !== o) {
        this.loadGridViewCols()
      }
    }
  },
  mounted() {
    // this.calculateColumnWidth()
  },
  created() {
    document.addEventListener('keydown', this.onKeyDown)
    this.loadGridViewCols()
    this.xcAuditModelCommentsCount()
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    async loadGridViewCols() {
      if (!this.viewId) {
        return
      }
      const colsData = (await this.$api.dbView.gridColumnsList(this.viewId))
      this.gridViewCols = colsData.reduce((o, col) => ({
        ...o,
        [col.fk_column_id]: col
      }), {})
    },
    onFileDrop(event) {
      this.$emit('drop', event)
    },
    isRequired(_columnObj, rowObj, ignoreCurrentValue = false) {
      if (this.isPublicView || this.loading) {
        return false
      }

      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.column_name === columnObj.bt.column_name)
      }

      return columnObj && (columnObj.rqd &&
        (ignoreCurrentValue || rowObj[columnObj.title] === undefined || rowObj[columnObj.title] === null) &&
        !columnObj.default)
    },
    updateCol(row, column, value, columnObj, colIndex, rowIndex) {
      this.$set(row, column, value)
      this.onCellValueChange(colIndex, rowIndex, columnObj, true)
    },
    calculateColumnWidth() {
      // setTimeout(() => {
      //   const obj = {}
      //   this.meta && this.meta.columns && this.meta.columns.forEach((c) => {
      //     obj[c.title] = (columnStyling[c.uidt] && columnStyling[c.uidt].w) || undefined
      //   })
      //   this.meta && this.meta.v && this.meta.v.forEach((v) => {
      //     obj[v.title] = v.bt ? '100px' : '200px'
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
      // const aggCount = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
      //   dbAlias: this.nodes.dbAlias
      // }, 'xcAuditModelCommentsCount', {
      //   model_name: this.meta.title,
      //   ids: this.data.map(({ row: r }) => {
      //     return this.meta.columns.filter(c => c.pk).map(c => r[c.title]).join('___')
      //   })
      // }])
      //

      this.aggCount = (await this.$api.utils.commentCount({
        ids: this.data.map(({ row: r }) => {
          return this.meta.columns.filter(c => c.pk).map(c => r[c.title]).join('___')
        }),
        fk_model_id: this.meta.id
      }))
    },

    async onKeyDown(e) {
      if (this.selected.col === null || this.selected.row === null || this.isLocked) {
        return
      }

      switch (e.keyCode) {
        // tab
        case 9:
          e.preventDefault()
          this.editEnabled = {
            col: null,
            row: null
          }
          if (e.shiftKey) {
            if (this.selected.col > 0) {
              this.selected.col--
            } else if (this.selected.row > 0) {
              this.selected.row--
              this.selected.col = this.colLength - 1
            }
          } else if (this.selected.col < this.colLength - 1) {
            this.selected.col++
          } else if (this.selected.row < this.rowLength - 1) {
            this.selected.row++
            this.selected.col = 0
          }

          break
        // delete
        case 46: {
          if (this.editEnabled.col != null && this.editEnabled.row != null) {
            return
          }

          const rowObj = this.data[this.selected.row].row
          const columnObj = this.availableColumns[this.selected.col]

          if (
            // this.isRequired(columnObj, rowObj, true) ||
            columnObj.virtual) {
            return
          }

          this.$set(rowObj, columnObj.title, null)
          // update/save cell value
          this.onCellValueChange(this.selected.col, this.selected.row, columnObj, true)
        }
          break
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

          const rowObj = this.data[this.selected.row].row
          const columnObj = this.availableColumns[this.selected.col]

          if (e.metaKey || e.ctrlKey) {
            switch (e.keyCode) {
              // copy - ctrl/cmd +c
              case 67:
                copyTextToClipboard(rowObj[columnObj.title] || '')
                break
              // // paste ctrl/cmd + v
              // case 86: {
              //   const text = await navigator.clipboard.readText()
              //   this.$set(rowObj, columnObj.title, text)
              // }
              // break
            }
          }

          if (e.ctrlKey ||
            e.altKey ||
            e.metaKey) {
            return
          }

          if (e.key && e.key.length === 1) {
            if (!this.isPkAvail && !this.data[this.selected.row].rowMeta.new) {
              return this.$toast.info('Update not allowed for table which doesn\'t have primary Key').goAway(3000)
            }

            this.$set(this.data[this.selected.row].row, this.availableColumns[this.selected.col].title, '')
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
      this.editEnabled.col = null
      this.editEnabled.row = null
    },
    onNewColCreation(col, oldCol) {
      this.addNewColMenu = false
      this.addNewColModal = false
      this.$emit('onNewColCreation', col, oldCol)
    },
    expandRow(...args) {
      this.$emit('expandRow', ...args)
      this.$tele.emit('record:expand-row')
    },
    showRowContextMenu($event, rowObj, rowMeta, row, ...rest) {
      this.$emit('showRowContextMenu', $event, rowObj, rowMeta, row, ...rest)
    },
    onCellValueChange(col, row, column, saved) {
      this.$emit('onCellValueChange', col, row, column, saved)
    },
    navigateToNext() {
      if (this.selected.row < this.rowLength - 1) {
        this.selected.row++
      }
    },
    navigateToPrev() {
      if (this.selected.row > 0) {
        this.selected.row--
      }
    },
    addNewRelationTab(...args) {
      this.$emit('addNewRelationTab', ...args)
    },
    makeSelected(col, row) {
      if (this.selected.col !== col || this.selected.row !== row) {
        this.selected = {
          col,
          row
        }
        this.editEnabled = {}
      }
    },
    makeEditable(col, row, _, rowMeta) {
      if (this.isPublicView || !this.isEditable || this.isView) {
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
        this.editEnabled = {
          col,
          row
        }
      }
    },
    enableEditable(column) {
      return ((column && column.uidt === UITypes.Attachment) ||
        (column && column.uidt === UITypes.SingleSelect) ||
        (column && column.uidt === UITypes.MultiSelect) ||
        (column && column.uidt === UITypes.DateTime) ||
        (column && column.uidt === UITypes.Date) ||
        (column && column.uidt === UITypes.Time) ||
        (this.sqlUi && column.dt && this.sqlUi.getAbstractType((column)) === 'boolean')
      )
    },
    insertNewRow(atEnd = false, expand = false) {
      this.$emit('insertNewRow', atEnd, expand)
    },
    async onresize(colId, size) {
      const gridColId = this.gridViewCols && this.gridViewCols[colId] && this.gridViewCols[colId].id
      if (!gridColId) {
        return
      }
      this.$set(this.gridViewCols[colId], 'width', size)
      if (this._isUIAllowed('gridColUpdate')) {
        await this.$api.dbView.gridColumnUpdate(gridColId, {
          width: size
        })
      }
      // this.$emit('update:columnsWidth', { ...this.columnsWidth, [col]: size })
    },
    onXcResizing(_cn, width) {
      this.resizingCol = _cn
      this.resizingColWidth = width
    },
    log(e, s) {
      console.log(e.target, s)
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
