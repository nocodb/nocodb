<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsLockedInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  PaginationDataInj,
  ReadonlyInj,
  ReloadViewDataHookInj,
  createEventHook,
  enumColor,
  inject,
  onClickOutside,
  onMounted,
  provide,
  reactive,
  ref,
  useEventListener,
  useGridViewColumnWidth,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  useViewData,
  watch,
} from '#imports'
import type { Row } from '~/composables'
import { NavigateDir } from '~/lib'

const { t } = useI18n()

const meta = inject(MetaInj)

const view = inject(ActiveViewInj)

// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))
const readOnly = inject(ReadonlyInj, false)
const isLocked = inject(IsLockedInj, ref(false))

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const { isUIAllowed } = useUIPermission()
const hasEditPermission = isUIAllowed('xcDatatableEditable')

// todo: get from parent ( inject or use prop )
const isView = false

const selected = reactive<{ row: number | null; col: number | null }>({ row: null, col: null })
const selectedRows = reactive({ startCol: NaN, endCol: NaN, startRow: NaN, endRow: NaN }) //save the first and the last column where the mouse is down while the value isSelectedRow is true
const rangeRows = reactive({ minRow: NaN, maxRow: NaN, minCol: NaN, maxCol: NaN }) // calculate the min and the max column where the mouse is down while the value isSelectedRow is true

let editEnabled = $ref(false)
let isSelectedBlock = $ref(false) //check if mouse event is down or up false=mouseup and true=mousedown

const { xWhere, isPkAvail, cellRefs, isSqlView } = useSmartsheetStoreOrThrow()

const addColumnDropdown = ref(false)

const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission) {
      _contextMenu.value = val
    }
  },
})

const contextMenuTarget = ref<{ row: number; col: number } | null>(null)
const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()

const visibleColLength = $computed(() => fields.value?.length)

const {
  isLoading,
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  selectedAllRecords,
  removeLastEmptyRow,
} = useViewData(meta, view as any, xWhere)

const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view as any)
onMounted(loadGridViewColumns)

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(true))

provide(PaginationDataInj, paginationData)

provide(ChangePageInj, changePage)

provide(ReadonlyInj, !hasEditPermission)

reloadViewDataHook?.on(async () => {
  await loadData()
})

const expandForm = (row: Row, state?: Record<string, any>) => {
  expandedFormRow.value = row
  expandedFormRowState.value = state
  expandedFormDlg.value = true
}

openNewRecordFormHook?.on(async () => {
  const newRow = await addEmptyRow()
  expandForm(newRow)
})

const selectCell = (row: number, col: number) => {
  clearRangeRows()
  selected.row = row
  selected.col = col
}

const selectBlock = (row: number, col: number) => {
  // if selected.col and selected.row are null and isSelectedBlock is true thats mean you are selecting a block
  if (selected.col === null || selected.row === null) {
    if(isSelectedBlock){
      //save the next value after the selectionStart
      selectedRows.endCol = col
      selectedRows.endRow = row
    }
  }else if(selected.col !== col || selected.row !== row){
     // if selected.col and selected.row is not null but the selected col and row are not equal at the row and col where the mouse is over 
     //and isSelectedBlock is true thats mean you are starting to select a block
    if(isSelectedBlock){
      selected.col = null
      selected.row = null
      //save the next value after the selectionStart
      selectedRows.endCol = col
      selectedRows.endRow = row
    }
  }
}

const selectedRange = (row: number, col: number)=>{
  if(!isNaN(selectedRows.startRow) && !isNaN(selectedRows.startCol) && !isNaN(selectedRows.endRow) && !isNaN(selectedRows.endCol)){
    //for know the direction of the selection
    rangeRows.minRow=Math.min(selectedRows.startRow, selectedRows.endRow),
    rangeRows.maxRow=Math.max(selectedRows.startRow, selectedRows.endRow),
    rangeRows.minCol=Math.min(selectedRows.startCol, selectedRows.endCol),
    rangeRows.maxCol=Math.max(selectedRows.startCol, selectedRows.endCol)
    //return if the column is between of the selection
    return (col>=rangeRows.minCol && col<=rangeRows.maxCol) && (row>=rangeRows.minRow && row<=rangeRows.maxRow);
  }else{
    return false
  }
}

const startSelectRange = (event: MouseEvent, row: number, col: number)=>{
  //if editEnabled is true but the selected col or the selected row is not equal to current row or col,
  // can selected multiple rows
  if(editEnabled && (selected.col !== col || selected.row !== row)){
    event.preventDefault()
  }else if(!editEnabled){
    //if editEnabled is not true, can selected multiple rows
    event.preventDefault()
  }
  //clear the selection when the event mousedown is fired
  selectedRows.startCol = NaN
  selectedRows.endCol = NaN
  selectedRows.startRow = NaN
  selectedRows.endRow = NaN
  //assign the first value to the selection
  selectedRows.startCol = col
  selectedRows.startRow = row
  isSelectedBlock = true
}

const clearRangeRows = ()=>{
  //when the selection starts or ends or when enter/arrow/tab is pressed 
  //this clear the previous selection
  rangeRows.minCol = NaN
  rangeRows.maxCol = NaN
  rangeRows.minRow = NaN
  rangeRows.maxRow = NaN
  selectedRows.startRow = NaN
  selectedRows.startCol = NaN 
  selectedRows.endRow = NaN
  selectedRows.endCol = NaN
}

watch(
  () => (view?.value as any)?.id,
  async (n?: string, o?: string) => {
    if (n && o && n !== o) {
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

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = null
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
  if (!hasEditPermission || editEnabled || isView) {
    return
  }
  if (!isPkAvail.value && !row.rowMeta.new) {
    // Update not allowed for table which doesn't have primary Key
    message.info(t('msg.info.updateNotAllowedWithoutPK'))
    return
  }
  if (col.ai) {
    // Auto Increment field is not editable
    message.info(t('msg.info.autoIncFieldNotEditable'))
    return
  }
  if (col.pk && !row.rowMeta.new) {
    // Editing primary key not supported
    message.info(t('msg.info.editingPKnotSupported'))
    return
  }
  return (editEnabled = true)
}

/** handle keypress events */
const onKeyDown = async (e: KeyboardEvent) => {
  if(!isNaN(selectedRows.startRow) && !isNaN(selectedRows.startCol) && !isNaN(selectedRows.endRow) && !isNaN(selectedRows.endCol)){
    //In case the user press tabs or arrows keys
    selected.row = selectedRows.startRow
    selected.col = selectedRows.startCol
  }
  if (selected.row === null || selected.col === null) return
  /** on tab key press navigate through cells */
  switch (e.key) {
    case 'Tab':
      e.preventDefault()
      clearRangeRows()
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
      clearRangeRows()
      makeEditable(data.value[selected.row], fields.value[selected.col])
      break
    /** on delete key press clear cell */
    case 'Delete':
      if (!editEnabled) {
        e.preventDefault()
        clearRangeRows()
        await clearCell(selected as { row: number; col: number })
      }
      break
    /** on arrow key press navigate through cells */
    case 'ArrowRight':
      e.preventDefault()
      clearRangeRows()
      if (selected.col < visibleColLength - 1) selected.col++
      break
    case 'ArrowLeft':
      clearRangeRows()
      e.preventDefault()
      clearRangeRows()
      if (selected.col > 0) selected.col--
      break
    case 'ArrowUp':
      clearRangeRows()
      e.preventDefault()
      clearRangeRows()
      if (selected.row > 0) selected.row--
      break
    case 'ArrowDown':
      clearRangeRows()
      e.preventDefault()
      clearRangeRows()
      if (selected.row < data.value.length - 1) selected.row++
      break
    default:
      {
        const rowObj = data.value[selected.row]
        const columnObj = fields.value[selected.col]
        let cptext = '' //variable for save the text to be copy
        if(!isNaN(rangeRows.minRow) && !isNaN(rangeRows.maxRow) && !isNaN(rangeRows.minCol) && !isNaN(rangeRows.maxCol)){
          const cprows = data.value.slice(rangeRows.minRow, rangeRows.maxRow+1) //slice the the selected rows for copy
          const cpcols = fields.value.slice(rangeRows.minCol, rangeRows.maxCol+1) //slice the the selected cols for copy
          cprows.forEach((row)=>{
            cpcols.forEach((col)=>{
              cptext = `${cptext} ${row.row[col.title]} \t`
            })
            cptext = `${cptext.trim()}\n`
          })
          cptext.trim()
        }else{
          cptext = rowObj.row[columnObj.title] || ''
        }

        if ((!editEnabled && e.metaKey) || e.ctrlKey) {
          switch (e.keyCode) {
            // copy - ctrl/cmd +c
            case 67:
              await copy(cptext)
              break
          }
        }

        if (editEnabled || e.ctrlKey || e.altKey || e.metaKey) {
          return
        }

        /** on letter key press make cell editable and empty */
        if (e?.key?.length === 1) {
          if (!isPkAvail && !rowObj.rowMeta.new) {
            // Update not allowed for table which doesn't have primary Key
            return message.info(t('msg.info.updateNotAllowedWithoutPK'))
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
useEventListener(document, 'mouseup', (e)=>{
  //if the editEnabled is false prevent the mouseup event for not select text
  if(!editEnabled){
    e.preventDefault()
  }
  isSelectedBlock = false
})

/** On clicking outside of table reset active cell  */
const smartTable = ref(null)
onClickOutside(smartTable, () => {
  clearRangeRows()
  if (selected.col === null) return

  const activeCol = fields.value[selected.col]

  if (editEnabled && (isVirtualCol(activeCol) || activeCol.uidt === UITypes.JSON)) return
  selected.row = null
  selected.col = null
})

const onNavigate = (dir: NavigateDir) => {
  if (selected.row === null || selected.col === null) return
  switch (dir) {
    case NavigateDir.NEXT:
      if (selected.row < data.value.length - 1) {
        selected.row++
      } else {
        editEnabled = false
      }
      break
    case NavigateDir.PREV:
      if (selected.row > 0) {
        selected.row--
      } else {
        editEnabled = false
      }
      break
  }
}

const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0 w-full">
    <div v-if="isLoading" class="flex items-center justify-center h-full w-full">
      <a-spin size="large" />
    </div>
    <div v-else class="nc-grid-wrapper min-h-0 flex-1 scrollbar-thin-dull">
      <a-dropdown v-model:visible="contextMenu" :trigger="isSqlView ? [] : ['contextmenu']">
        <table
          ref="smartTable"
          class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white"
          @contextmenu="showContextMenu"
        >
          <thead>
            <tr class="nc-grid-header border-1 bg-gray-100 sticky top[-1px]">
              <th>
                <div class="w-full h-full bg-gray-100 flex min-w-[70px] pl-5 pr-1 items-center">
                  <template v-if="!readOnly">
                    <div class="nc-no-label text-gray-500" :class="{ hidden: selectedAllRecords }">#</div>
                    <div
                      :class="{ hidden: !selectedAllRecords, flex: selectedAllRecords }"
                      class="nc-check-all w-full items-center"
                    >
                      <a-checkbox v-model:checked="selectedAllRecords" />

                      <span class="flex-1" />
                    </div>
                  </template>
                  <template v-else>
                    <div class="text-gray-500">#</div>
                  </template>
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
                <div class="w-full h-full bg-gray-100 flex items-center">
                  <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="readOnly" />

                  <SmartsheetHeaderCell v-else :column="col" :hide-menu="readOnly" />
                </div>
              </th>
              <th
                v-if="!readOnly && !isLocked && isUIAllowed('add-column') && !isSqlView"
                v-t="['c:column:add']"
                class="cursor-pointer"
                @click.stop="addColumnDropdown = true"
              >
                <a-dropdown v-model:visible="addColumnDropdown" :trigger="['click']">
                  <div class="h-full w-[60px] flex items-center justify-center">
                    <MdiPlus class="text-sm nc-column-add" />
                  </div>

                  <template #overlay>
                    <SmartsheetColumnEditOrAddProvider
                      v-if="addColumnDropdown"
                      @submit="addColumnDropdown = false"
                      @cancel="addColumnDropdown = false"
                      @click.stop
                      @keydown.stop
                    />
                  </template>
                </a-dropdown>
              </th>
            </tr>
          </thead>
          <!--this prevent select text from field if not in edit mode-->
          <tbody @selectstart.prevent>
            <SmartsheetRow v-for="(row, rowIndex) of data" :key="rowIndex" :row="row">
              <template #default="{ state }">
                <tr class="nc-grid-row">
                  <td key="row-index" class="caption nc-grid-cell pl-5 pr-1">
                    <div class="items-center flex gap-1 min-w-[55px]">
                      <div
                        v-if="!readOnly || !isLocked"
                        class="nc-row-no text-xs text-gray-500"
                        :class="{ toggle: !readOnly, hidden: row.rowMeta.selected }"
                      >
                        {{ rowIndex + 1 }}
                      </div>
                      <div
                        v-if="!readOnly"
                        :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }"
                        class="nc-row-expand-and-checkbox"
                      >
                        <a-checkbox v-model:checked="row.rowMeta.selected" />
                      </div>
                      <span class="flex-1" />
                      <div v-if="!readOnly && !isLocked" class="nc-expand" :class="{ 'nc-comment': row.rowMeta?.commentCount }">
                        <span
                          v-if="row.rowMeta?.commentCount"
                          class="py-1 px-3 rounded-full text-xs cursor-pointer select-none transform hover:(scale-110)"
                          :style="{ backgroundColor: enumColor.light[row.rowMeta.commentCount % enumColor.light.length] }"
                          @click="expandForm(row, state)"
                        >
                          {{ row.rowMeta.commentCount }}
                        </span>
                        <div
                          v-else
                          class="cursor-pointer flex items-center border-1 active:ring rounded p-1 hover:(bg-primary bg-opacity-10)"
                        >
                          <MdiArrowExpand
                            v-t="['c:row-expand']"
                            class="select-none transform hover:(text-accent scale-120) nc-row-expand"
                            @click="expandForm(row, state)"
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    v-for="(columnObj, colIndex) of fields"
                    :ref="cellRefs.set"
                    :key="columnObj.id"
                    class="cell relative cursor-pointer nc-grid-cell"
                    :class="{
                      active: isUIAllowed('xcDatatableEditable') && selected.col === colIndex && selected.row === rowIndex || isUIAllowed('xcDatatableEditable') && selectedRange(rowIndex, colIndex),
                    }"
                    :data-key="rowIndex + columnObj.id"
                    :data-col="columnObj.id"
                    :data-title="columnObj.title"
                    @click="selectCell(rowIndex, colIndex)"
                    @dblclick="makeEditable(row, columnObj)"
                    @mousedown="startSelectRange($event, rowIndex, colIndex)"
                    @mouseover="selectBlock(rowIndex, colIndex)"
                    @contextmenu="showContextMenu($event, { row: rowIndex, col: colIndex })"
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
                        :edit-enabled="
                          isUIAllowed('xcDatatableEditable') &&
                          editEnabled &&
                          selected.col === colIndex &&
                          selected.row === rowIndex
                        "
                        :row-index="rowIndex"
                        :active="selected.col === colIndex && selected.row === rowIndex"
                        @update:edit-enabled="editEnabled = false"
                        @save="updateOrSaveRow(row, columnObj.title)"
                        @navigate="onNavigate"
                        @cancel="editEnabled = false"
                      />
                    </div>
                  </td>
                </tr>
              </template>
            </SmartsheetRow>

            <!--
      TODO: add relationType !== 'bt' ?
      v1: <tr v-if="!isView && !isLocked && !isPublicView && isEditable && relationType !== 'bt'">
    -->
            <tr v-if="!isView && !isLocked && isUIAllowed('xcDatatableEditable') && !isSqlView">
              <td
                v-t="['c:row:add:grid-bottom']"
                :colspan="visibleColLength + 1"
                class="text-left pointer nc-grid-add-new-cell cursor-pointer"
                @click="addEmptyRow()"
              >
                <div class="px-2 w-full flex items-center text-gray-500">
                  <MdiPlus class="text-pint-500 text-xs ml-2 text-primary" />

                  <span class="ml-1">
                    {{ $t('activity.addRow') }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <template v-if="!isLocked && isUIAllowed('xcDatatableEditable')" #overlay>
          <a-menu class="shadow !rounded !py-0" @click="contextMenu = false">
            <a-menu-item v-if="contextMenuTarget" @click="deleteRow(contextMenuTarget.row)">
              <div v-t="['a:row:delete']" class="nc-project-menu-item">
                <!-- Delete Row -->
                {{ $t('activity.deleteRow') }}
              </div>
            </a-menu-item>

            <a-menu-item @click="deleteSelectedRows">
              <div v-t="['a:row:delete-bulk']" class="nc-project-menu-item">
                <!-- Delete Selected Rows -->
                {{ $t('activity.deleteSelectedRow') }}
              </div>
            </a-menu-item>

            <!--            Clear cell -->
            <a-menu-item v-if="contextMenuTarget" @click="clearCell(contextMenuTarget)">
              <div v-t="['a:row:clear']" class="nc-project-menu-item">{{ $t('activity.clearCell') }}</div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget" @click="addEmptyRow(contextMenuTarget.row + 1)">
              <div v-t="['a:row:insert']" class="nc-project-menu-item">
                <!-- Insert New Row -->
                {{ $t('activity.insertRow') }}
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <SmartsheetPagination />

    <SmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
      @cancel="removeLastEmptyRow"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full overflow-auto;

  td,
  th {
    min-height: 41px !important;
    height: 41px !important;
    position: relative;
  }

  td:not(:first-child) > div {
    overflow: hidden;
    @apply flex items-center h-auto px-1;
  }

  table,
  td,
  th {
    @apply !border-1;
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
    @apply bg-primary bg-opacity-5;
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

.nc-grid-row {
  .nc-row-expand-and-checkbox {
    @apply w-full items-center justify-between;
  }

  .nc-expand {
    &:not(.nc-comment) {
      @apply hidden;
    }

    &.nc-comment {
      display: flex;
    }
  }

  &:hover {
    .nc-row-no.toggle {
      @apply hidden;
    }

    .nc-expand {
      @apply flex;
    }

    .nc-row-expand-and-checkbox {
      @apply flex;
    }
  }
}

.nc-grid-header {
  position: sticky;
  top: -1px;

  @apply z-1;

  &:hover {
    .nc-no-label {
      @apply hidden;
    }

    .nc-check-all {
      @apply flex;
    }
  }
}

tbody tr:hover {
  @apply bg-gray-100 bg-opacity-50;
}
</style>
