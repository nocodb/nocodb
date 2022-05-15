<template>
  <v-container
    class="h-100 j-excel-container "
    :class="{
      'pa-0 ma-0': ! notFound
    }"
    fluid
  >
    <v-alert v-if="notFound" type="warning" class="mx-auto mt-10" outlined max-width="300">
      Not found
    </v-alert>
    <template v-else>
      <div v-if="viewName" class="model-name">
        <span class="font-weight-bold"> {{ viewName }}</span> <span class="font-weight-regular ml-1" />
      </div>
      <v-toolbar v-if="meta" height="40" dense class="elevation-0 xc-toolbar xc-border-bottom" style="z-index: 7;border-radius: 4px">
        <v-spacer />
        <v-btn outlined small text @click="reload">
          <v-icon small class="mr-1" color="grey  darken-3">
            mdi-reload
          </v-icon>
          <!-- Reload -->
          {{ $t('general.reload') }}
        </v-btn>
        <fields-menu v-model="showFields" :field-list="fieldList" is-public />
        <sort-list-menu v-model="sortList" :field-list="realFieldList" />
        <column-filter-menu v-model="filters" :field-list="realFieldList" />
        <csv-export-import :query-params="{...queryParams, showFields}" :public-view-id="$route.params.id" :meta="meta" />
      </v-toolbar>
      <div
        v-if="meta"
        class="nc-grid-wrapper d-flex"
        :class="`cell-height-${cellHeight}`"
        style="overflow:auto;transition: width 500ms "
      >
        <v-container v-if="loadingData" fluid>
          <v-row>
            <v-col v-for="idx in 5" :key="idx">
              <v-skeleton-loader type="image@3" />
            </v-col>
          </v-row>
        </v-container>
        <kanban-view
          v-if="!loadingData && kanban.data.length"
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
          @loadMoreKanbanData="(groupingFieldVal) => loadMoreKanbanData(groupingFieldVal)"
        />
      </div>
    </template>
  </v-container>
</template>

<script>
/* eslint-disable camelcase */
import spreadsheet from '../mixins/spreadsheet'
import FieldsMenu from '../components/fieldsMenu'
import SortListMenu from '../components/sortListMenu'
import ColumnFilterMenu from '../components/columnFilterMenu'
import CsvExportImport from '~/components/project/spreadsheet/components/moreActions'
import KanbanView from '@/components/project/spreadsheet/views/kanbanView'
export default {
  name: 'XcKanban',
  components: { CsvExportImport, ColumnFilterMenu, SortListMenu, FieldsMenu, KanbanView },
  mixins: [spreadsheet],
  props: {
    env: String,
    nodes: Object,
    relationType: String,
    relation: Object,
    relationIdValue: [String, Number],
    refTable: String,
    relationPrimaryValue: [String, Number]
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
  computed: {

  },
  async mounted() {
    try {
      await this.loadMetaData()
      if (!this.showPasswordModal && !this.notFound) {
        await this.loadKanbanData()
      }
    } catch (e) {
      console.log(e)
    }
    this.searchField = this.primaryValueColumn
  },
  methods: {
    async loadMetaData() {
      this.loading = true
      try {
        // eslint-disable-next-line camelcase
        const {
          meta,
          // model_name,
          view_name,
          view_type,
          client,
          query_params: qp = {},
          db_alias: dbAlias = '_noco',
          relatedTableMetas = {}
        } = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'sharedViewGet', {
          view_id: this.$route.params.id,
          password: this.password
        }])

        this.fieldsOrder = qp.fieldsOrder || []
        this.viewName = view_name
        this.viewType = view_type

        this.columnsWidth = qp.columnsWidth || {}

        this.client = client
        this.meta = meta
        this.query_params = qp
        this.dbAlias = dbAlias
        this.metas = relatedTableMetas
        this.sortList = qp.sortList || []

        this.showFields = this.query_params.showFields || {}

        // this.fieldList = Object.keys(this.showFields)

        let fields = this.query_params.fieldsOrder || []
        if (!fields.length) { fields = Object.keys(this.showFields) }
        // eslint-disable-next-line camelcase

        let columns = this.meta.columns
        if (this.meta && this.meta.v) {
          columns = [...columns, ...this.meta.v.map(v => ({ ...v, virtual: 1 }))]
        }

        {
          const _ref = {}
          columns.forEach((c) => {
            if (c.virtual && c.bt) {
              c.prop = `${c.bt.rtn}Read`
            }
            if (c.virtual && c.mm) {
              c.prop = `${c.mm.rtn}MMList`
            }
            if (c.virtual && c.hm) {
              c.prop = `${c.hm.table_name}List`
            }

            c.alias = c.title
            if (c.alias in _ref) {
              c.alias += _ref[c.alias]++
            } else {
              _ref[c.alias] = 1
            }
          })
        }
      } catch (e) {
        if (e.message === 'Not found' || e.message === 'Meta not found') {
          this.notFound = true
        } else if (e.message === 'Invalid password') {
          this.showPasswordModal = true
        } else {
          console.log(e)
        }
      }

      this.loadingData = false
    },
    async loadKanbanData() {
      this.loadingData = true
      try {
        // TODO
      } catch (e) {
        this.showPasswordModal = true
      }

      this.loadingData = false
    },
    async unlock() {
      this.showPasswordModal = false
      await this.reload()
    },
    async reload() {
      await this.loadMetaData()
      await this.loadKanbanData()
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

.nc-grid-wrapper{
  height:calc(100vh - 120px)
}

.nc-grid{
  height: calc(100% - 34px)
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
