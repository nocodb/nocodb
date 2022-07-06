<template>
  <v-container
    class="h-100 j-excel-container"
    :class="{
      'pa-0 ma-0': !notFound,
    }"
    fluid
  >
    <v-alert v-if="notFound" type="warning" class="mx-auto mt-10" outlined max-width="300"> Not found </v-alert>

    <template v-else>
      <div v-if="viewName" class="model-name">
        <span class="font-weight-bold"> {{ viewName }}</span> <span class="font-weight-regular ml-1" />
      </div>

      <v-toolbar
        v-if="meta"
        height="40"
        dense
        class="nc-table-toolbar elevation-0 xc-toolbar xc-border-bottom"
        style="z-index: 7; border-radius: 4px"
      >
        <div class="d-inline-flex">
          <fields-menu
            v-model="showFields"
            :field-list="fieldList"
            :fields-order.sync="fieldsOrder"
            is-public
            :meta="meta"
            :show-system-fields="showSystemFields"
          />

          <sort-list-menu
            v-model="sorts"
            :meta="meta"
            :shared="true"
            :field-list="realFieldList"
            @input="loadTableData"
          />

          <column-filter-menu
            v-model="filters"
            :meta="meta"
            :field-list="realFieldList"
            :shared="true"
            @input="loadTableData"
          />

          <more-actions
            v-if="allowCSVDownload"
            :is-view="isView"
            :query-params="{ ...queryParams, showFields, fieldsOrder }"
            :public-view-id="$route.params.id"
            :meta="meta"
            :req-payload="{ filters, sorts, password }"
          />
        </div>
        <v-spacer class="h-100" @dblclick="debug = true" />
      </v-toolbar>

      <div
        v-if="meta"
        class="nc-grid-wrapper d-flex"
        :class="`cell-height-${cellHeight}`"
        style="overflow: auto; transition: width 500ms"
      >
        <div class="flex-grow-1 h-100" style="overflow-y: auto">
          <div ref="table" class="nc-grid" style="overflow: auto; width: 100%">
            <v-skeleton-loader v-if="loadingData" type="table" />

            <xc-grid-view
              v-else
              is-public-view
              :meta="tableMeta"
              :metas="metas"
              :data="data"
              :available-columns="availableColumns"
              :show-fields="showFields"
              :nodes="{ ...nodes, dbConnection: { client } }"
              :sql-ui="sqlUi"
              :columns-width="columnsWidth"
              :password="password"
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
        </div>
      </div>
    </template>
    <v-dialog v-model="showPasswordModal" width="400">
      <v-card width="400" class="backgroundColor">
        <v-container fluid>
          <v-text-field
            v-model="password"
            dense
            autocomplete="shared-table-password"
            browser-autocomplete="shared-table-password"
            type="password"
            solo
            flat
            hint="Enter the password"
            persistent-hint
          />

          <div class="text-center">
            <v-btn small color="primary" @click="unlock"> Unlock </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
/* eslint-disable camelcase */

import { ErrorMessages, SqlUiFactory } from 'nocodb-sdk'
import spreadsheet from '../mixins/spreadsheet'
import ApiFactory from '../apis/apiFactory'
import FieldsMenu from '../components/FieldsMenu'
import SortListMenu from '../components/SortListMenu'
import ColumnFilterMenu from '../components/ColumnFilterMenu'
import XcGridView from '../views/GridView'
import MoreActions from '~/components/project/spreadsheet/components/MoreActions'

export default {
  name: 'XcTable',
  components: {
    MoreActions,
    XcGridView,
    ColumnFilterMenu,
    SortListMenu,
    FieldsMenu,
  },
  mixins: [spreadsheet],
  props: {
    env: String,
    nodes: Object,
    relationType: String,
    relation: Object,
    relationIdValue: [String, Number],
    refTable: String,
    relationPrimaryValue: [String, Number],
    isView: Boolean,
  },
  data: () => ({
    notFound: false,
    viewName: null,
    viewType: null,
    columnsWidth: {},
    metas: {},
    fieldsOrder: [],
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
    meta: null,
    navDrawer: true,
    selected: {
      row: null,
      col: null,
    },
    editEnabled: {
      row: null,
      col: null,
    },
    page: 1,
    count: 0,
    size: 25,
    xWhere: '',
    sort: '',

    cellHeight: 'small',

    isAnyFieldHidden: false,
    opList: [
      'is equal',
      'is not equal',
      'is like',
      'is not like',
      'is empty',
      'is not empty',
      'is null',
      'is not null',
    ],
    fieldFilter: '',

    filters: [],
    sorts: [],

    data: [],
    spreadsheet: null,
    options: {
      allowToolbar: true,
      columnSorting: false,
    },
    filteredData: [],
    showFields: {},
    // fieldList: [],

    cellHeights: [
      {
        size: 'small',
        icon: 'mdi-view-headline',
      },
      {
        size: 'medium',
        icon: 'mdi-view-sequential',
      },
      {
        size: 'large',
        icon: 'mdi-view-stream',
      },
      {
        size: 'xlarge',
        icon: 'mdi-card',
      },
    ],
    rowContextMenu: null,
    modelName: null,
    tableMeta: null,
    allowCSVDownload: true,
  }),
  computed: {
    concatenatedXWhere() {
      let where = '';
      if (this.searchField && this.searchQuery.trim()) {
        if (
          ['text', 'string'].includes(
            this.sqlUi.getAbstractType(this.meta.columns.find(({ _cn }) => _cn === this.searchField))
          )
        ) {
          where = `(${this.searchField},like,%${this.searchQuery.trim()}%)`;
        } else {
          where = `(${this.searchField},eq,${this.searchQuery.trim()})`;
        }
      }

      if (!where) {
        return this.xWhere;
      }

      return this.xWhere ? where + `~and(${this.xWhere})` : where;
    },
    sqlUi() {
      // todo: replace with correct client
      return SqlUiFactory.create({ client: this.client });
    },
    queryParams() {
      return {
        limit: this.size,
        offset: this.size * (this.page - 1),
        where: this.concatenatedXWhere,
        sort: this.sort,
      };
    },
    api() {
      return ApiFactory.create(
        this.$store.getters['project/GtrProjectType'],
        this.table,
        this.meta && this.meta.columns,
        this,
        this.meta
      );
    },
    colLength() {
      return (this.meta && this.meta.columns && this.meta.columns.length) || 0;
    },
    visibleColLength() {
      return (this.meta && this.meta.columns && this.meta.columns.length) || 0;
    },
    rowLength() {
      return (this.data && this.data.length) || 0;
    },
    edited() {
      return this.data && this.data.some(r => r.rowMeta && (r.rowMeta.new || r.rowMeta.changed));
    },
    table() {
      if (this.relationType === 'hm') {
        return this.relation.table_name;
      } else if (this.relationType === 'bt') {
        return this.relation.rtn;
      }

      return this.nodes.table_name || this.nodes.view_name;
    },
    primaryValueColumn() {
      if (!this.meta || !this.meta.columns) {
        return '';
      }

      const pvIndex = this.meta.columns.findIndex(c => c.pv);

      if (pvIndex > -1 && pvIndex <= this.colLength - 1) {
        return this.meta.columns[pvIndex].title;
      }

      const pkIndex = this.meta.columns.findIndex(c => c.pv);

      if (pkIndex > -1 && pkIndex < this.colLength - 1) {
        return this.meta.columns[pkIndex + 1].title;
      }
      return this.meta.columns[0].title;
    },
  },
  async mounted() {
    try {
      await this.loadMetaData();
      if (!this.showPasswordModal && !this.notFound) {
        await this.loadTableData();
      }
    } catch (e) {
      console.log(e);
    }
    this.searchField = this.primaryValueColumn;
  },
  created() {
    document.addEventListener('keydown', this.onKeyDown);
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown);
  },
  methods: {
    comingSoon() {
      this.$toast.info('Coming soon!').goAway(3000);
    },
    makeSelected(col, row) {
      if (this.selected.col !== col || this.selected.row !== row) {
        this.selected = {
          col,
          row,
        };
        this.editEnabled = {};
      }
    },
    makeEditable(col, row) {
      if (this.meta.columns[col].ai) {
        return this.$toast.info('Auto Increment field is not editable').goAway(3000);
      }
      if (this.meta.columns[col].pk && !this.data[row].rowMeta.new) {
        return this.$toast.info('Editing primary key not supported').goAway(3000);
      }
      if (this.editEnabled.col !== col || this.editEnabled.row !== row) {
        this.editEnabled = {
          col,
          row,
        };
      }
    },

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      // ctrl + s -> save
      // ctrl + l -> reload
      // ctrl + n -> new
      switch ([this._isMac ? metaKey : ctrlKey, key].join('_')) {
        case 'true_s':
          this.edited && (await this.save());
          break;
        case 'true_l':
          await this.loadTableData();
          break;
        case 'true_n':
          this.insertNewRow(true);
          break;
      }
    },

    addFilter() {
      this.filters.push({
        field: '',
        op: '',
        value: '',
        logicOp: 'and',
      });
      this.filters = this.filters.slice();
    },
    addSort() {
      this.sorts.push({
        field: '',
        order: '',
      });
      this.filters = this.filters.slice();
    },
    async loadMetaData() {
      this.loading = true;
      try {
        this.viewMeta = await this.$api.public.sharedViewMetaGet(this.$route.params.id, {
          headers: {
            'xc-password': this.password
          }
        }))
        this.tableMeta = this.viewMeta.model
        this.meta = { ...this.viewMeta.model }
        this.meta.columns = this.meta.columns.filter(c => c.show)
        this.metas = this.viewMeta.relatedMetas
        this.showSystemFields = this.viewMeta.show_system_fields

        this.sorts = this.viewMeta.sorts
        this.viewName = this.viewMeta.title
        this.client = this.viewMeta.client
        this.allowCSVDownload = JSON.parse(this.viewMeta.meta).allowCSVDownload
      } catch (e) {
        if (e.response && e.response.status === 404) {
          this.notFound = true;
        } else if ((await this._extractSdkResponseErrorMsg(e)) === ErrorMessages.INVALID_SHARED_VIEW_PASSWORD) {
          this.showPasswordModal = true;
        } else {
          console.log(e);
        }
      }

      this.loadingData = false;
    },

    async loadTableData() {
      this.loadingData = true;
      try {
        const {
          data: {
            list,
            pageInfo: { totalRows: count },
          },
        } = await this.$api.public.dataList(
          this.$route.params.id,
          {
            sortArrJson: JSON.stringify(
              this.sorts &&
                this.sorts.map(({ fk_column_id, direction }) => ({
                  direction,
                  fk_column_id,
                }))
            ),
            filterArrJson: JSON.stringify(this.filters),
            ...this.queryParams,
          },
          {
            headers: { 'xc-password': this.password },
          }
        );

        this.count = count;
        this.data = list.map(row => ({
          row,
          oldRow: { ...row },
          rowMeta: {},
        }));
      } catch (e) {
        if (e.response && e.response.status === 404) {
          this.notFound = true;
        } else if ((await this._extractSdkResponseErrorMsg(e)) === ErrorMessages.INVALID_SHARED_VIEW_PASSWORD) {
          this.showPasswordModal = true;
        } else {
          console.log(e);
        }
      }

      this.loadingData = false;
    },
    onKeyDown(e) {
      if (this.selected.col === null || this.selected.row === null) {
        return;
      }
      switch (e.keyCode) {
        // left
        case 37:
          if (this.selected.col > 0) {
            this.selected.col--;
          }
          break;
        // right
        case 39:
          if (this.selected.col < this.colLength - 1) {
            this.selected.col++;
          }
          break;
        // up
        case 38:
          if (this.selected.row > 0) {
            this.selected.row--;
          }
          break;
        // down
        case 40:
          if (this.selected.row < this.rowLength - 1) {
            this.selected.row++;
          }
          break;
        // enter
        case 13:
          this.makeEditable(this.selected.col, this.selected.row);
          break;
      }
    },
    showRowContextMenu(e, row, rowMeta, index) {
      e.preventDefault();
      this.rowContextMenu = false;
      this.$nextTick(() => {
        this.rowContextMenu = {
          x: e.clientX,
          y: e.clientY,
          row,
          index,
          rowMeta,
        };
      });
    },
    expandRow(row, rowMeta) {
      this.showExpandModal = true;
      this.selectedExpandRowIndex = row;
      this.selectedExpandRowMeta = rowMeta;
    },
    async unlock() {
      this.showPasswordModal = false;
      await this.reload();
    },
    async reload() {
      await this.loadMetaData();
      await this.loadTableData();
    },
  },
};
</script>
<style scoped>
/deep/ .v-input__control .v-input__slot .v-input--selection-controls__input {
  transform: scale(0.85);
  margin-right: 0;
}

/deep/ .xc-toolbar .v-input__slot,
.navigation .v-input__slot {
  box-shadow: none !important;
}

/deep/ .navigation .v-input__slot input::placeholder {
  font-size: 0.8rem;
}

/deep/ .v-btn {
  text-transform: capitalize;
}

/deep/ .xc-bt-chip {
  margin-right: 12px;
  transition: 0.4s margin-right, 0.4s padding-right;
}

/deep/ .xc-border.search-box {
  overflow: visible;
  border-radius: 4px;
}

/deep/ .xc-border.search-box .v-input {
  transition: 0.4s border-color;
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

.nc-grid-wrapper {
  height: calc(100vh - 120px);
}

.nc-grid {
  height: calc(100% - 34px);
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
