<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import {
  inject,
  onKeyStroke,
  onMounted,
  provide,
  useGridViewColumnWidth,
  useProvideColumnCreateStore,
  useViewData,
  useSmartsheetStoreOrThrow
} from '#imports'
import {
  ActiveViewInj,
  ChangePageInj,
  EditModeInj,
  FieldsInj,
  IsFormInj,
  IsGridInj,
  IsLockedInj,
  MetaInj,
  PaginationDataInj,
  ReloadViewDataHookInj,
} from '~/context'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiArrowExpandIcon from '~icons/mdi/arrow-expand'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))
const isLocked = inject(IsLockedInj, false)
// todo: get from parent ( inject or use prop )
const isPublicView = false

const selected = reactive<{ row?: number | null; col?: number | null }>({})
const editEnabled = ref(false)
const { sqlUi } = useProject()
const { xWhere } = useSmartsheetStoreOrThrow()
const addColumnDropdown = ref(false)

const visibleColLength = computed(() => {
  const cols = fields.value
  return cols.filter((col) => !isVirtualCol(col)).length
})

const {
  loadData,
  paginationData,
  formattedData: data,
  updateRowProperty,
  changePage,
  addRow,
  selectedRows,
} = useViewData(meta, view as any, xWhere)
const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view)
onMounted(loadGridViewColumns)

provide(IsFormInj, false)
provide(IsGridInj, true)
provide(PaginationDataInj, paginationData)
provide(EditModeInj, editEnabled)
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
  () => (view?.value as any)?.id,
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
// watchEffect(() => {
if (meta) useProvideColumnCreateStore(meta)
// })
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
                  <SmartsheetColumnEditOrAdd @click.stop @cancel="addColumnDropdown = false" />
                </template>
              </a-dropdown>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="({ row, rowMeta }, rowIndex) in data" :key="rowIndex" class="nc-grid-row group">
            <td key="row-index" class="caption nc-grid-cell">
              <div class="align-center flex w-[80px]">
                <div class="group-hover:hidden" :class="{ hidden: rowMeta.checked }">{{ rowIndex + 1 }}</div>
                <div :class="{ hidden: !rowMeta.checked, flex: rowMeta.checked }" class="group-hover:flex w-full align-center">
                  <a-checkbox v-model:checked="rowMeta.checked" />
                  <span class="flex-1" />
                  <MdiArrowExpandIcon class="text-sm text-pink hidden group-hover:inline-block" />
                </div>
              </div>
            </td>
            <td
              v-for="(columnObj, colIndex) in fields"
              :key="rowIndex + columnObj.title"
              class="cell pointer nc-grid-cell"
              :class="{
                active: !isPublicView && selected.col === colIndex && selected.row === rowIndex
              }"
              :data-col="columnObj.id"
              @click="selectCell(rowIndex, colIndex)"
              @dblclick="editEnabled = true"
            >

              <SmartsheetVirtualCell v-if="isVirtualCol(columnObj)" v-model="row[columnObj.title]" :column="columnObj" />

              <SmartsheetCell
                v-else
                v-model="row[columnObj.title]"
                :column="columnObj"
                :edit-enabled="editEnabled && selected.col === colIndex && selected.row === rowIndex"
                @update:model-value="updateRowProperty(row, columnObj.title)"
              />
            </td>
          </tr>

          <tr v-if="!isLocked">
            <td
              v-t="['c:row:add:grid-bottom']"
              :colspan="visibleColLength + 1"
              class="text-left pointer nc-grid-add-new-cell"
              @click="addRow()"
            >
              <a-tooltip top left>
                <div class="w-min flex align-center">
                  <MdiPlusIcon class="text-pint-500 text-xs" />
                  <span class="ml-1 caption grey--text">
                    {{ $t('activity.addRow') }}
                  </span>
                </div>
                <template #title>
                  <span class="caption"> Add new row</span>
                </template>
              </a-tooltip>
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
    padding: 0 5px;

    & > * {
      @apply flex align-center h-auto;
    }
    overflow: hidden;
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
    @apply border-2 border-solid border-primary;
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
