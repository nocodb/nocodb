<script lang="ts" setup>
import { onClickOutside, useEventListener } from '@vueuse/core'
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import {
  inject,
  onMounted,
  provide,
  useGridViewColumnWidth,
  useProvideColumnCreateStore,
  useSmartsheetStoreOrThrow,
  useViewData,
} from '#imports'
import type { Row } from '~/composables'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGridInj,
  IsLockedInj,
  MetaInj,
  PaginationDataInj,
  ReloadViewDataHookInj,
} from '~/context'
import { NavigateDir } from '~/lib'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))
const isLocked = inject(IsLockedInj, false)
// todo: get from parent ( inject or use prop )
const isPublicView = false
const isView = false

const selected = reactive<{ row: number | null; col: number | null }>({ row: null, col: null })
let editEnabled = $ref(false)
const { xWhere, isPkAvail } = useSmartsheetStoreOrThrow()
const addColumnDropdown = ref(false)
const contextMenu = ref(false)
const contextMenuTarget = ref(false)

const visibleColLength = $computed(() => fields.value?.length)

const {
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  selectedAllRecords,
} = useViewData(meta, view as any, xWhere)
const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view as any)
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
if (meta) useProvideColumnCreateStore(meta)

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = false
  }
})

const clearCell = async (ctx: { row: number; col: number }) => {
  const rowObj = data.value[ctx.row]
  const columnObj = fields.value[ctx.col]

  if (isVirtualCol(columnObj)) {
    return
  }

  rowObj.row[columnObj.title] = null
  // update/save cell value
  await updateOrSaveRow(rowObj, columnObj.title)
}

const { copy } = useClipboard()

const makeEditable = (row: Row, col: ColumnType) => {
  if (isPublicView || editEnabled || isView) {
    return
  }
  if (!isPkAvail.value && !row.rowMeta.new) {
    message.info("Update not allowed for table which doesn't have primary Key")
    return
  }
  if (col.ai) {
    message.info('Auto Increment field is not editable')
    return
  }
  if (col.pk && !row.rowMeta.new) {
    message.info('Editing primary key not supported')
    return
  }
  return (editEnabled = true)
}

/** handle keypress events */
const onKeyDown = async (e: KeyboardEvent) => {
  if (selected.row === null || selected.col === null) return
  /** on tab key press navigate through cells */
  switch (e.key) {
    case 'Tab':
      e.preventDefault()
      if (e.shiftKey) {
        if (selected.col > 0) {
          selected.col--
        } else if (selected.row > 0) {
          selected.row--
          selected.col = visibleColLength - 1
        }
      } else {
        if (selected.col < visibleColLength - 1) {
          selected.col++
        } else if (selected.row < data.value.length - 1) {
          selected.row++
          selected.col = 0
        }
      }
      break
    /** on enter key press make cell editable */
    case 'Enter':
      e.preventDefault()
      makeEditable(data.value[selected.row], fields.value[selected.col])
      break
    /** on delete key press clear cell */
    case 'Delete':
      e.preventDefault()
      await clearCell(selected as { row: number; col: number })
      break
    /** on arrow key press navigate through cells */
    case 'ArrowRight':
      e.preventDefault()
      if (selected.col < visibleColLength - 1) selected.col++
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (selected.col > 0) selected.col--
      break
    case 'ArrowUp':
      e.preventDefault()
      if (selected.row > 0) selected.row--
      break
    case 'ArrowDown':
      e.preventDefault()
      if (selected.row < data.value.length - 1) selected.row++
      break
    default:
      {
        const rowObj = data.value[selected.row]
        const columnObj = fields.value[selected.col]

        if (e.metaKey || e.ctrlKey) {
          switch (e.keyCode) {
            // copy - ctrl/cmd +c
            case 67:
              await copy(rowObj.row[columnObj.title] || '')
              break
          }
        }

        if (editEnabled || e.ctrlKey || e.altKey || e.metaKey) {
          return
        }

        /** on letter key press make cell editable and empty */
        if (e?.key?.length === 1) {
          if (!isPkAvail && !rowObj.rowMeta.new) {
            return message.info("Update not allowed for table which doesn't have primary Key")
          }
          if (makeEditable(rowObj, columnObj)) {
            rowObj.row[columnObj.title] = ''
          }
          // editEnabled = true
        }
      }
      break
  }
}

useEventListener(document, 'keydown', onKeyDown)

/** On clicking outside of table reset active cell  */
const smartTable = ref(null)
onClickOutside(smartTable, () => {
  selected.row = null
  selected.col = null
})

const onNavigate = (dir: NavigateDir) => {
  if (selected.row === null || selected.col === null) return
  switch (dir) {
    case NavigateDir.NEXT:
      if (selected.row < data.value.length - 1) {
        selected.row++
      }
      break
    case NavigateDir.PREV:
      if (selected.row > 0) {
        selected.row--
      }
      break
  }
}
</script>

<template>
  <div class="flex flex-col h-100 min-h-0 w-100">
    <div class="nc-grid-wrapper min-h-0 flex-1 scrollbar-thin-primary">
      <a-dropdown v-model:visible="contextMenu" :trigger="['contextmenu']">
        <table ref="smartTable" class="xc-row-table nc-grid backgroundColorDefault" @contextmenu.prevent="contextMenu = true">
          <thead>
            <tr class="group">
              <th>
                <div class="flex align-center w-[80px]">
                  <div class="group-hover:hidden" :class="{ hidden: selectedAllRecords }">#</div>
                  <div
                    :class="{ hidden: !selectedAllRecords, flex: selectedAllRecords }"
                    class="group-hover:flex w-full align-center"
                  >
                    <a-checkbox v-model:checked="selectedAllRecords" />
                    <span class="flex-1" />
                  </div>
                </div>
              </th>
              <th
                v-for="col in fields"
                :key="col.title"
                v-xc-ver-resize
                :data-col="col.id"
                :data-title="col.title"
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
                  <div class="h-full w-[60px] flex align-center justify-center">
                    <MdiPlus class="text-sm" />
                  </div>
                  <template #overlay>
                    <SmartsheetColumnEditOrAdd @click.stop @cancel="addColumnDropdown = false" />
                  </template>
                </a-dropdown>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) of data" :key="rowIndex" class="nc-grid-row">
              <td key="row-index" class="caption nc-grid-cell group">
                <div class="flex items-center w-[80px]">
                  <div class="group-hover:hidden" :class="{ hidden: row.rowMeta.selected }">{{ rowIndex + 1 }}</div>
                  <div
                    :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }"
                    class="group-hover:flex w-full items-center justify-between p-1"
                  >
                    <a-checkbox v-model:checked="row.rowMeta.selected" />
                    <div class="cursor-pointer flex items-center border-1 active:ring rounded p-1 hover:bg-primary/10">
                      <MdiArrowExpand class="select-none transform hover:(text-pink-500 scale-120)" />
                    </div>
                  </div>
                </div>
              </td>
              <td
                v-for="(columnObj, colIndex) of fields"
                :key="rowIndex + columnObj.title"
                class="cell pointer nc-grid-cell"
                :class="{
                  active: !isPublicView && selected.col === colIndex && selected.row === rowIndex,
                }"
                :data-col="columnObj.id"
                :data-title="columnObj.title"
                @click="selectCell(rowIndex, colIndex)"
                @dblclick="makeEditable(row, columnObj)"
                @contextmenu="contextMenuTarget = { row: rowIndex, col: colIndex }"
              >
                <div class="w-full h-full">
                  <SmartsheetVirtualCell
                    v-if="isVirtualCol(columnObj)"
                    v-model="row.row[columnObj.title]"
                    :column="columnObj"
                    :active="selected.col === colIndex && selected.row === rowIndex"
                    :row="row"
                    @navigate="onNavigate"
                  />

                  <SmartsheetCell
                    v-else
                    v-model="row.row[columnObj.title]"
                    :column="columnObj"
                    :edit-enabled="editEnabled && selected.col === colIndex && selected.row === rowIndex"
                    @update:edit-enabled="editEnabled = false"
                    @save="updateOrSaveRow(row, columnObj.title)"
                    @navigate="onNavigate"
                    @cancel="editEnabled = false"
                  />
                </div>
              </td>
            </tr>

            <tr v-if="!isLocked">
              <td
                v-t="['c:row:add:grid-bottom']"
                :colspan="visibleColLength + 1"
                class="text-left pointer nc-grid-add-new-cell"
                @click="addEmptyRow()"
              >
                <a-tooltip top left>
                  <div class="w-full flex align-center">
                    <MdiPlus class="text-pint-500 text-xs" />
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
        <template #overlay>
          <div class="bg-white shadow" @click="contextMenu = false">
            <div v-if="contextMenuTarget" class="nc-menu-item" @click="deleteRow(contextMenuTarget.row)">Delete row</div>
            <div class="nc-menu-item" @click="deleteSelectedRows">Delete all selected rows</div>
            <div v-if="contextMenuTarget" class="nc-menu-item" @click="clearCell(contextMenuTarget)">Clear cell</div>
            <div v-if="contextMenuTarget" class="nc-menu-item" @click="addEmptyRow(contextMenuTarget.row + 1)">
              Insert new row
            </div>
          </div>
        </template>
      </a-dropdown>
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
    //padding: 0 5px;

    & > div {
      overflow: hidden;
      @apply flex align-center h-auto;
      padding: 0 5px;
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
  }

  td {
    text-overflow: ellipsis;
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
    background: #0040bc;
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
