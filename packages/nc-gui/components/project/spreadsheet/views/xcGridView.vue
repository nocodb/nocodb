<template>
  <div>
    <table v-if="data" class="xc-row-table"
           style=" ">
      <thead>
      <tr class="text-left">
        <th
          class="grey-border caption"
          :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4 grey--text text--darken-2'"
          style="width: 65px">#
        </th>
        <th
          class="grey-border caption font-wight-regular"
          :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4  grey--text text--darken-2'"
          v-xc-ver-resize
          v-for="(col,i) in availableColumns"
          :key="i + '_' + col._cn"
          v-show="showFields[col._cn]"
          @xcresize="onresize(col._cn,$event)"
          @xcresizing="onXcResizing(col._cn,$event)"
          @xcresized="resizingCol = null"
          :data-col="col._cn"
        >
          <!--            :style="columnsWidth[col._cn]  ? `min-width:${columnsWidth[col._cn]}; max-width:${columnsWidth[col._cn]}` : ''"
          -->

          <virtual-header-cell v-if="col.virtual"
                               :column="col"
                               :nodes="nodes"
                               :meta="meta"
                               @saved="onNewColCreation"
          />


          <header-cell
            v-else
            :isPublicView="isPublicView"
            @onRelationDelete="$emit('onRelationDelete')"
            :nodes="nodes"
            :value="col._cn"
            :sql-ui="sqlUi"
            :meta="meta"
            :column-index="meta && meta.columns && meta.columns.indexOf(col)"
            :is-foreign-key="col._cn in belongsTo || col._cn in hasMany"
            :column="col"
            :isVirtual="isVirtual"
            @saved="onNewColCreation"
          ></header-cell>

        </th>

        <th
          v-if="!isLocked && !isVirtual && !isPublicView && _isUIAllowed('add-column')"
          @click="addNewColMenu = true"
          :class="$store.state.windows.darkTheme ? 'grey darken-3 grey--text text--lighten-1' : 'grey lighten-4  grey--text text--darken-2'"
          class="grey-border new-column-header pointer"
        >
          <v-menu offset-y z-index="99" left v-model="addNewColMenu"
                  content-class="elevation-0"
          >
            <template v-slot:activator="{on}">
              <v-icon small v-on="on">mdi-plus</v-icon>
            </template>
            <edit-column
              v-if="addNewColMenu"
              :meta="meta"
              :nodes="nodes"
              @close="addNewColMenu = false"
              @saved="onNewColCreation"
              :sql-ui="sqlUi"
            ></edit-column>
          </v-menu>
        </th>


      </tr>
      </thead>
      <tbody v-click-outside="onClickOutside">
      <tr
        v-for="({row:rowObj, rowMeta, oldRow},row) in data"
        :key="row"
        @contextmenu="showRowContextMenu($event,rowObj,rowMeta,row)"
      >
        <td
          style="width: 65px" class="caption">
          <div class="d-flex align-center">
            <span v-show="!rowMeta || !rowMeta.selected" class="ml-2 grey--text"
                  :class="{ 'row-no' : !isPublicView }"
            >{{ row + 1 }}</span>
            <template v-if="!isPublicView">
              <v-checkbox v-if="rowMeta" class="row-checkbox pt-0 align-self-center my-auto"
                          :class="{active : rowMeta.selected}"
                          v-model="rowMeta.selected"
                          dense></v-checkbox>
              <v-spacer></v-spacer>
              <v-icon
                v-if="!groupedAggCount[ids[row]]"
                color="pink"
                small
                class="row-expand-icon mr-1 pointer"
                @click="expandRow(row,rowMeta)">
                mdi-arrow-expand
              </v-icon>
            </template>
            <v-chip
              @click="expandRow(row,rowMeta)"
              x-small v-if="groupedAggCount[ids[row]]"
              :color="colors[ groupedAggCount[ids[row]] % colors.length]">
              {{ groupedAggCount[ids[row]] }}
            </v-chip>
          </div>
        </td>
        <td
          class="cell pointer"
          v-for="(columnObj,col) in availableColumns"
          :key="row + '_' +  col + columnObj._cn"
          :class="{
              'active' : !isPublicView && selected.col === col && selected.row === row && isEditable ,
              'primary-column' : primaryValueColumn === columnObj._cn,
              'text-center': isCentrallyAligned(columnObj),
              'required': isRequired(columnObj,rowObj)
            }"
          @dblclick="makeEditable(col,row,columnObj.ai)"
          @click="makeSelected(col,row);"
          v-show="showFields[columnObj._cn]"
          :data-col="columnObj._cn"
        >
          <virtual-cell
            v-if="columnObj.virtual "
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
          ></virtual-cell>

          <!--
                    <span
                      v-if="columnObj.virtual "
                    ></span>
          -->

          <editable-cell
            v-else-if="
            !isLocked
              && !isPublicView
              && (editEnabled.col === col && editEnabled.row === row)
              || enableEditable(columnObj)
            "
            :column="columnObj"
            :meta="meta"
            :active="selected.col === col && selected.row === row"
            v-model="rowObj[columnObj._cn]"
            @save="editEnabled = {}"
            @cancel="editEnabled = {}"
            @update="onCellValueChange(col, row, columnObj)"
            @blur="onCellValueChange(col, row, columnObj,'blur')"
            @change="onCellValueChange(col, row, columnObj)"
            :sql-ui="sqlUi"
            :db-alias="nodes.dbAlias"
          />

          <!--
                    <div v-else-if="columnObj.cn in hasMany" class="hasmany-col d-flex ">
                      {{ rowObj[columnObj._cn] }}
                      <v-spacer></v-spacer>
                      <v-menu open-on-hover>
                        <template v-slot:activator="{on}">
                          <v-icon v-on="on" class=" hasmany-col-menu-icon">mdi-menu-down</v-icon>
                        </template>

                        <v-list dense>
                          <v-list-item v-for="(rel,i) in hasMany[columnObj.cn]"
                                       @click="addNewRelationTab(
                                               rel,
                                               table,
                                               meta._tn,
                                               rel.tn,
                                               rel._tn,
                                               rowObj[columnObj._cn],
                                               'hm',
                                               rowObj,
                                               rowObj[primaryValueColumn]
                                               )"
                                       :key="i"
                          >
                            <v-chip small :color="colors[i % colors.length]">
                              <span class="caption text-capitalize"> {{ rel._tn }}</span>
                            </v-chip>
                          </v-list-item>
                        </v-list>
                      </v-menu>

                    </div>
                    <span v-else-if="columnObj._cn in belongsTo"
                          @click="addNewRelationTab(
                                  belongsTo[columnObj._cn],
                                  table,
                                  meta._tn,
                                  belongsTo[columnObj._cn].rtn,
                                  belongsTo[columnObj._cn]._rtn,
                                  rowObj[columnObj._cn],
                                  'bt',
                                  rowObj,
                                  rowObj[primaryValueColumn]
                                  )"
                          class="belongsto-col">{{ rowObj[columnObj._cn] }}</span>

                    <template v-else-if="primaryValueColumn === columnObj._cn">
                      <v-menu open-on-hover offset-y bottom>
                        <template v-slot:activator="{on}">
                          &lt;!&ndash;                    <v-chip v-on="on"
                                                      small
                                                      class="caption xc-bt-chip"
                                                      outlined
                                                      color="success">
                                                {{ rowObj[columnObj.cn] }}
                                                <v-icon v-on="on" class="hasmany-col-menu-icon pv">mdi-menu-down</v-icon>
                                              </v-chip>  &ndash;&gt;

                          <span v-on="on"
                                class="caption xc-bt-chip primary&#45;&#45;text">
                                {{ rowObj[columnObj._cn] }}
                                <v-icon v-on="on" class="hasmany-col-menu-icon pv">mdi-menu-down</v-icon>
                              </span>

                        </template>

                        <v-list dense>
                          <v-list-item dense v-if="haveHasManyrelation"><span class="grey&#45;&#45;text caption text-center mt-n2">Has Many</span>
                          </v-list-item>
                          <template v-if="haveHasManyrelation">
                            <template v-for="(hm,idCol) in hasMany">
                              <template v-for="(rel,i) in hm">


                                <v-divider
                                  :key="i + '_' +  idCol + '_div'"></v-divider>
                                <v-list-item
                                  class="py-1"
                                  @click="addNewRelationTab(
                                               rel,
                                               table,
                                               meta._tn,
                                               rel.tn,
                                               rel._tn,
                                               rowObj[idCol],
                                               'hm',
                                               rowObj,
                                               rowObj[primaryValueColumn]
                                               )"
                                  :key="i + '_' + idCol"
                                  dense
                                >
                                  <v-list-item-icon class="mx-1">
                                    <v-icon class="has-many-icon mr-1" small :color="textColors[i % colors.length]">
                                      mdi-source-fork
                                    </v-icon>
                                  </v-list-item-icon>
                                  &lt;!&ndash;                        <v-chip small  >&ndash;&gt;
                                  &lt;!&ndash;                         <v-list-item-title> &ndash;&gt;
                                  <span class="caption text-capitalize"> {{ rel._tn }}</span>
                                  &lt;!&ndash;                        </v-list-item-title>&ndash;&gt;
                                  &lt;!&ndash;                        </v-chip>&ndash;&gt;
                                </v-list-item>
                              </template>
                            </template>
                          </template>
                          <v-list-item v-else>
                            <span class="caption text-capitalize grey&#45;&#45;text font-weight-light"> No relation found</span>
                          </v-list-item>
                        </v-list>
                      </v-menu>
                    </template>
          -->


          <table-cell v-else
                      :class="{'primary--text' : primaryValueColumn === columnObj._cn}"
                      :selected="selected.col === col && selected.row === row"
                      :isLocked="isLocked"
                      @enableedit="makeSelected(col,row);makeEditable(col,row,columnObj.ai)"
                      :column="columnObj"
                      :meta="meta"
                      :db-alias="nodes.dbAlias"
                      :value="rowObj[columnObj._cn]"
                      :sql-ui="sqlUi"
          ></table-cell>
        </td>
      </tr>
      <tr v-if="!isLocked && !isPublicView && isEditable && relationType !== 'bt'">
        <td :colspan="visibleColLength + 1" class="text-left pointer" @click="insertNewRow(true)">
          <v-tooltip top>
            <template v-slot:activator="{on}">
              <v-icon v-on="on" small color="pink">mdi-plus</v-icon>
              <span class="ml-1 caption grey--text ">New Row</span>
            </template>
            <span class="caption"> Add new row</span>
          </v-tooltip>
        </td>
      </tr>
      </tbody>
    </table>

    <div is="style" v-html="style"></div>

  </div>
</template>

<script>
import HeaderCell from "@/components/project/spreadsheet/components/headerCell";
import EditableCell from "@/components/project/spreadsheet/components/editableCell";
import EditColumn from "@/components/project/spreadsheet/components/editColumn";
import TableCell from "@/components/project/spreadsheet/components/cell";
import colors from "@/mixins/colors";
import columnStyling from "@/components/project/spreadsheet/helpers/columnStyling";
import HasManyCell from "@/components/project/spreadsheet/components/virtualCell/hasManyCell";
import BelongsToCell from "@/components/project/spreadsheet/components/virtualCell/belogsToCell";
import ManyToMany from "@/components/project/spreadsheet/components/virtualCell/manyToManyCell";
import VirtualCell from "@/components/project/spreadsheet/components/virtualCell";
import VirtualHeaderCell from "@/components/project/spreadsheet/components/virtualHeaderCell";

export default {
  components: {
    VirtualHeaderCell,
    VirtualCell, ManyToMany, BelongsToCell, HasManyCell, TableCell, EditColumn, EditableCell, HeaderCell
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
    columnsWidth: {type: Object}
  },
  mounted() {
    this.calculateColumnWidth();
  },
  methods: {
    isRequired(_columnObj, rowObj) {
      let columnObj = _columnObj;
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.cn === columnObj.bt.cn);
      }

      return columnObj && (columnObj.rqd
        && (rowObj[columnObj._cn] === undefined || rowObj[columnObj._cn] === null)
        && !columnObj.default);
    },
    updateCol(row, column, value, columnObj, colIndex, rowIndex) {
      this.$set(row, column, value);
      this.onCellValueChange(colIndex, rowIndex, columnObj)
    },
    calculateColumnWidth() {
      setTimeout(() => {
        const obj = {};
        this.meta && this.meta.columns && this.meta.columns.forEach(c => {
          obj[c._cn] = columnStyling[c.uidt] && columnStyling[c.uidt].w || undefined;
        })
        this.meta && this.meta.v && this.meta.v.forEach(v => {
          obj[v._cn] = v.bt ? '100px' : '200px';
        })
        Array.from(this.$el.querySelectorAll('th')).forEach(el => {
          const width = el.getBoundingClientRect().width;
          obj[el.dataset.col] = obj[el.dataset.col] || ((width < 100 ? 100 : width) + 'px');
        });
        this.$emit('update:columnsWidth', {...obj, ...(this.columnWidth || {})})
      }, 500)
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
      if (this.isPublicView || !this.data || !this.data.length) return;
      const aggCount = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        dbAlias: this.nodes.dbAlias
      }, 'xcAuditModelCommentsCount', {
        model_name: this.meta._tn,
        ids: this.data.map(({row: r}) => {
          return this.meta.columns.filter((c) => c.pk).map(c => r[c._cn]).join('___')
        })
      }])

      this.aggCount = aggCount;
    },

    onKeyDown(e) {
      if (this.selected.col === null || this.selected.row === null) return;
      switch (e.keyCode) {
        // left
        case 37:
          if (this.selected.col > 0) this.selected.col--;
          break;
        // right
        case 39:
          if (this.selected.col < this.colLength - 1) this.selected.col++;
          break;
        // up
        case 38:
          if (this.selected.row > 0) this.selected.row--;
          break;
        // down
        case 40:
          if (this.selected.row < this.rowLength - 1) this.selected.row++;
          break;
        // enter
        case 13:
          this.makeEditable(this.selected.col, this.selected.row)
          break;
        default: {
          if (this.editEnabled.col != null && this.editEnabled.row != null) {
            return;
          }
          if (e.key && e.key.length === 1) {
            this.$set(this.data[this.selected.row].row, this.availableColumns[this.selected.col]._cn, e.key)
            this.editEnabled = {...this.selected}
          }
        }
      }
    },
    onClickOutside() {
      if (
        this.meta.columns
        && this.meta.columns[this.selected.col]
        && this.meta.columns[this.selected.col].virtual
      ) return
      this.selected.col = null;
      this.selected.row = null
    },
    onNewColCreation() {
      this.addNewColMenu = false;
      this.addNewColModal = false;
      this.$emit('onNewColCreation')
    },
    expandRow(...args) {
      this.$emit('expandRow', ...args)
    },
    showRowContextMenu($event, rowObj, rowMeta, row) {
      this.$emit('showRowContextMenu', $event, rowObj, rowMeta, row)
    },
    onCellValueChange(col, row, column, ev) {
      this.$emit('onCellValueChange', col, row, column, ev);
    },
    addNewRelationTab(...args) {
      this.$emit('addNewRelationTab', ...args)
    },
    makeSelected(col, row) {
      if (this.selected.col !== col || this.selected.row !== row) {
        this.selected = {col, row};
        this.editEnabled = {};
      }
    },
    makeEditable(col, row) {
      if (this.isPublicView || !this.isEditable) return;
      if (this.availableColumns[col].ai) {
        return this.$toast.info('Auto Increment field is not editable').goAway(3000)
      }
      if (this.availableColumns[col].pk && !this.data[row].rowMeta.new) {
        return this.$toast.info('Editing primary key not supported').goAway(3000)
      }
      if (this.editEnabled.col !== col || this.editEnabled.row !== row) {
        this.editEnabled = {col, row};
      }
    },
    enableEditable(column) {
      return (column && column.uidt === 'Attachment') ||
        (column && column.uidt === 'SingleSelect') ||
        (column && column.uidt === 'MultiSelect') ||
        (column && column.uidt === 'DateTime') ||
        (column && column.uidt === 'Date') ||
        (column && column.uidt === 'Time') ||
        (this.sqlUi && this.sqlUi.getAbstractType(column) === 'boolean');
    },
    insertNewRow(atEnd = false, expand = false) {
      this.$emit('insertNewRow', atEnd, expand)
    },
    onresize(col, size) {
      this.$emit('update:columnsWidth', {...this.columnsWidth, [col]: size});
    },
    onXcResizing(_cn, width) {
      this.resizingCol = _cn;
      this.resizingColWidth = width;
    }
  },
  computed: {
    ids() {
      return this.data.map(({oldRow}) => this.meta.columns.filter((c) => c.pk).map(c => oldRow[c._cn]).join('___'))
    },
    haveHasManyrelation() {
      return !!Object.keys(this.hasMany).length;
    },
    colLength() {
      return (this.availableColumns && this.availableColumns.length) || 0
    },
    // visibleColLength() {
    //   return (this.availableColumns && this.availableColumns.length) || 0
    // },
    rowLength() {
      return (this.data && this.data.length) || 0
    },
    availColNames() {
      return (this.availableColumns && this.availableColumns.map(c => c._cn)) || [];
    },
    groupedAggCount() {
      return this.aggCount ? this.aggCount.reduce((o, {model_id, count}) => ({...o, [model_id]: count}), {}) : {};
    },
    style() {
      let style = '';
      for (const [key, val] of Object.entries(this.columnsWidth || {})) {
        if (val && key !== this.resizingCol) {
          style += `
            [data-col="${key}"]{
              min-width: ${val};
              max-width: ${val};
              width: ${val};
            }
        `;
        } else if (key === this.resizingCol) {
          style += `
            [data-col="${key}"]{
              min-width: ${this.resizingColWidth};
              max-width: ${this.resizingColWidth};
              width: ${this.resizingColWidth};
            }
        `;
        }
      }

      return style;
    },
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
  created() {
    document.addEventListener('keydown', this.onKeyDown);
    this.xcAuditModelCommentsCount();
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown);
  },
  name: "xcGridView",
  watch: {
    data() {
      this.xcAuditModelCommentsCount();
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

th {
  min-width: 100px;
}


</style>
