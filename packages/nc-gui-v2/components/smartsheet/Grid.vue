<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import { inject, onKeyStroke, onMounted, provide } from '#imports'
import { useProvideColumnCreateStore } from '~/composables/useColumnCreateStore'
import useGridViewColumnWidth from '~/composables/useGridViewColumnWidth'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGridInj,
  MetaInj,
  PaginationDataInj,
  ReloadViewDataHookInj,
} from '~/context'
import useViewData from '~/composables/useViewData'
import MdiPlusIcon from '~icons/mdi/plus'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj)

// todo: get from parent ( inject or use prop )
const isPublicView = false

const selected = reactive<{ row?: number | null; col?: number | null }>({})
const editEnabled = ref(false)
const addColumnDropdown = ref(false)

const { loadData, paginationData, formattedData: data, updateRowProperty, changePage } = useViewData(meta, view)
const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view)
onMounted(loadGridViewColumns)

provide(IsFormInj, false)
provide(IsGridInj, true)
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)

const reloadViewDataHook = inject(ReloadViewDataHookInj)
reloadViewDataHook?.on(() => {
  loadData()
})

const selectCell = (row: number, col: number) => {
  selected.row = row
  selected.col = col
}

onKeyStroke(['Enter'], (e) => {
  if (selected.row !== null && selected.col !== null) {
    editEnabled.value = true
  }
})

watch(
  () => view?.value?.id,
  async (n?: string, o?: string) => {
    if (n && n !== o) {
      await loadData()
    }
  },
  { immediate: true },
)

const onresize = (colID: string, event: any) => {
  updateWidth(colID, event.detail)
}
const onXcResizing = (cn: string, event: any) => {
  resizingCol.value = cn
  resizingColWidth.value = event.detail
}

defineExpose({
  loadData,
})

// instantiate column create store
useProvideColumnCreateStore()
</script>

<template>
  <div class="flex flex-col h-100 min-h-0 w-100">
    <div class="nc-grid-wrapper min-h-0 flex-1 scrollbar-thin-primary">
      <table class="xc-row-table nc-grid backgroundColorDefault">
        <thead>
          <tr>
            <th>#</th>
            <th
              v-for="col in fields"
              :key="col.title"
              v-xc-ver-resize
              :data-col="col.id"
              @xcresize="onresize(col.id, $event)"
              @xcresizing="onXcResizing(col.title, $event)"
              @xcresized="resizingCol = null"
            >
              <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />
              <SmartsheetHeaderCell v-else :column="col" />
            </th>
            <!-- v-if="!isLocked && !isVirtual && !isPublicView && _isUIAllowed('add-column')" -->
            <th v-t="['c:column:add']" @click="addColumnDropdown = true">
              <a-dropdown v-model:visible="addColumnDropdown" :trigger="['click']">
                <div class="h-full w-full flex align-center justify-center">
                  <MdiPlusIcon class="text-sm" />
                </div>
                <template #overlay>
                  <SmartsheetColumnEditOrAdd @click.stop @cancel="editColumnDropdown = false" />
                </template>
              </a-dropdown>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="({ row }, rowIndex) in data" :key="rowIndex" class="nc-grid-row">
            <td key="row-index" style="width: 65px" class="caption nc-grid-cell">
              <div class="d-flex align-center">
                {{ rowIndex + 1 }}
              </div>
            </td>
            <td
              v-for="(columnObj, colIndex) in fields"
              :key="rowIndex + columnObj.title"
              class="cell pointer nc-grid-cell"
              :class="{
                active: !isPublicView && selected.col === colIndex && selected.row === rowIndex,
                // 'primary-column': primaryValueColumn === columnObj.title,
                // 'text-center': isCentrallyAligned(columnObj),
                // 'required': isRequired(columnObj, rowObj),
              }"
              :data-col="columnObj.id"
              @click="selectCell(rowIndex, colIndex)"
              @dblclick="editEnabled = true"
            >
              <!--          @contextmenu=" -->
              <!--            showRowContextMenu($event, rowObj, rowMeta, row, col, columnObj) -->
              <!--          " -->
              <!--        > -->
              <!--          <virtual-cell -->
              <!--            v-if="isVirtualCol(columnObj)" -->
              <!--            :password="password" -->
              <!--            :is-public="isPublicView" -->
              <!--            :metas="metas" -->
              <!--            :is-locked="isLocked" -->
              <!--            :column="columnObj" -->
              <!--            :row="rowObj" -->
              <!--            :nodes="nodes" -->
              <!--            :meta="meta" -->
              <!--            :api="api" -->
              <!--            :active="selected.col === col && selected.row === row" -->
              <!--            :sql-ui="sqlUi" -->
              <!--            :is-new="rowMeta.new" -->
              <!--            v-on="$listeners" -->
              <!--            @updateCol=" -->
              <!--              (...args) => -->
              <!--                updateCol( -->
              <!--                  ...args, -->
              <!--                  columnObj.bt -->
              <!--                    && meta.columns.find( -->
              <!--                      (c) => c.column_name === columnObj.bt.column_name, -->
              <!--                    ), -->
              <!--                  col, -->
              <!--                  row, -->
              <!--                ) -->
              <!--            " -->
              <!--            @saveRow="onCellValueChange(col, row, columnObj, true)" -->
              <!--          /> -->

              <!--          <editable-cell -->
              <!--            v-else-if=" -->
              <!--              ((isPkAvail || rowMeta.new) -->
              <!--                && !isView -->
              <!--                && !isLocked -->
              <!--                && !isPublicView -->
              <!--                && editEnabled.col === col -->
              <!--                && editEnabled.row === row) -->
              <!--                || enableEditable(columnObj) -->
              <!--            " -->
              <!--            v-model="rowObj[columnObj.title]" -->
              <!--            :column="columnObj" -->
              <!--            :meta="meta" -->
              <!--            :active="selected.col === col && selected.row === row" -->
              <!--            :sql-ui="sqlUi" -->
              <!--            :db-alias="nodes.dbAlias" -->
              <!--            :is-locked="isLocked" -->
              <!--            :is-public="isPublicView" -->
              <!--            :view-id="viewId" -->
              <!--            @save="editEnabled = {}; onCellValueChange(col, row, columnObj, true);" -->
              <!--            @cancel="editEnabled = {}" -->
              <!--            @update="onCellValueChange(col, row, columnObj, false)" -->
              <!--            @blur="onCellValueChange(col, row, columnObj, true)" -->
              <!--            @input="unsaved = true" -->
              <!--            @navigateToNext="navigateToNext" -->
              <!--            @navigateToPrev="navigateToPrev" -->
              <!--          /> -->

              <SmartsheetVirtualCell v-if="isVirtualCol(columnObj)" v-model="row[columnObj.title]" :column="columnObj" />

              <SmartsheetCell
                v-else
                v-model="row[columnObj.title]"
                :column="columnObj"
                :edit-enabled="editEnabled && selected.col === colIndex && selected.row === rowIndex"
                @update:model-value="updateRowProperty(row, columnObj.title)"
              />

              <!--          <SmartsheetCell v-else :column="columnObj" :value="row[columnObj.title]" /> -->
              <!-- :selected="selected.col === col && selected.row === row" -->
              <!--        :is-locked="isLocked" -->
              <!--            :column="columnObj" -->
              <!--            :meta="meta" -->
              <!--            :db-alias="nodes.dbAlias" -->
              <!--            :value="rowObj[columnObj.title]" -->
              <!--            :sql-ui="sqlUi" -->
              <!--            @enableedit=" -->
              <!--              makeSelected(col, row); -->
              <!--              makeEditable(col, row, columnObj.ai, rowMeta); -->
              <!--            " -->
              <!--          /> -->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <SmartsheetPagination />
  </div>
</template>

<style scoped lang="scss">
.nc-grid-wrapper {
  width: 100%;
  // todo : proper height calculation
  height: calc(100vh - 215px);
  overflow: auto;

  td,
  th {
    min-height: 41px !important;
    height: 41px !important;
    position: relative;
    padding: 0 5px !important;
    min-width: 200px;

    & > * {
      @apply flex align-center h-auto;
    }
  }

  table,
  td,
  th {
    border-right: 1px solid #7f828b33 !important;
    border-left: 1px solid #7f828b33 !important;
    border-bottom: 1px solid #7f828b33 !important;
    border-top: 1px solid #7f828b33 !important;
    border-collapse: collapse;

    font-size: 0.8rem;
  }

  td {
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  td.active::after,
  td.active::before {
    content: '';
    position: absolute;
    z-index: 3;
    height: calc(100% + 2px);
    width: calc(100% + 2px);
    left: -1px;
    top: -1px;
    pointer-events: none;
  }

  // todo: replace with css variable
  td.active::after {
    border: 2px solid #0040bc; /*var(--v-primary-lighten1);*/
  }

  td.active::before {
    background: #0040bc /*var(--v-primary-base)*/;
    opacity: 0.1;
  }
}

:deep {
  .resizer:hover,
  .resizer:active,
  .resizer:focus {
    // todo: replace with primary color
    @apply bg-blue-500/50;
    cursor: col-resize;
  }
}
</style>
