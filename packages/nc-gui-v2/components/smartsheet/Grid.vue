<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import {
  inject,
  onKeyStroke,
  onMounted,
  provide,
  useGridViewColumnWidth,
  useProvideColumnCreateStore,
  useSmartsheetStoreOrThrow,
  useViewData,
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

const selected = reactive<{ row: number | null; col: number | null }>({ row: null, col: null })
let editEnabled = $ref(false)
const { sqlUi } = useProject()
const { xWhere } = useSmartsheetStoreOrThrow()
const addColumnDropdown = ref(false)
const contextMenu = ref(false)
const contextMenuTarget = ref(false)

const visibleColLength = $computed(() => {
  const cols = fields.value
  return cols.filter((col) => !isVirtualCol(col)).length
})

const {
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow,
  selectedRows,
  deleteRow,
  deleteSelectedRows,
} = useViewData(meta, view as any, xWhere)
const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view as any)
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
    editEnabled = true
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

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = false
  }
})

/** handle keypress events */
onKeyStroke(['Tab', 'Shift', ''], (e: KeyboardEvent) => {
  if (selected.row !== null && selected.col !== null) {
    /** on tab key press navigate through cells */
    if (e.key === 'Tab') {
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
    }
  }
})
/** on shift + tab key press navigate through cells in reverse order */
// onKeyStroke(, (e) => {
//   if (selected.row !== null && selected.col !== null) {
//     e.preventDefault()
//     if (selected.col > 0) {
//       selected.col--
//     } else if (selected.row > 0) {
//       selected.row--
//       selected.col = visibleColLength - 1
//     }
//   }
// })
// /** on delete key press clear the cell */
// onKeyStroke(['Tab', 'Shift'], (e) => {
//   if (selected.row !== null && selected.col !== null) {
//     e.preventDefault()
//     // check and clear cell
//   }
// })
// /** on enter key press make cell editable */
// onKeyStroke('Enter', (e) => {
//   if (selected.row !== null && selected.col !== null) {
//     e.preventDefault()
//     editEnabled = true
//   }
// })

/*

async onKeyDown(e) {
  if (selected.col === null || selected.row === null || isLocked) {
    return;
  }

  switch (e.keyCode) {
    // tab
    case 9:
      e.preventDefault();
      this.editEnabled = {
        col: null,
        row: null,
      };
      if (e.shiftKey) {
        if (this.selected.col > 0) {
          this.selected.col--;
        } else if (this.selected.row > 0) {
          this.selected.row--;
          this.selected.col = this.colLength - 1;
        }
      } else if (this.selected.col < this.colLength - 1) {
        this.selected.col++;
      } else if (this.selected.row < this.rowLength - 1) {
        this.selected.row++;
        this.selected.col = 0;
      }

      break;
    // delete
    case 46:
    {
      if (this.editEnabled.col != null && this.editEnabled.row != null) {
        return;
      }

      const rowObj = this.data[this.selected.row].row;
      const columnObj = this.availableColumns[this.selected.col];

      if (
        // this.isRequired(columnObj, rowObj, true) ||
        columnObj.virtual
      ) {
        return;
      }

      this.$set(rowObj, columnObj.title, null);
      // update/save cell value
      this.onCellValueChange(this.selected.col, this.selected.row, columnObj, true);
    }
      break;
    // left
    case 37:
      if (this.rightToLeftLanguages.includes(this.$store.state.settings.language)) {
        if (this.selected.col < this.colLength - 1) {
          this.selected.col++;
        }
      } else if (this.selected.col > 0) {
        this.selected.col--;
      }
      break;
    // right
    case 39:
      if (this.rightToLeftLanguages.includes(this.$store.state.settings.language)) {
        if (this.selected.col > 0) {
          this.selected.col--;
        }
      } else if (this.selected.col < this.colLength - 1) {
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
    default: {
      if (this.editEnabled.col != null && this.editEnabled.row != null) {
        return;
      }

      const rowObj = this.data[this.selected.row].row;
      const columnObj = this.availableColumns[this.selected.col];

      if (e.metaKey || e.ctrlKey) {
        switch (e.keyCode) {
          // copy - ctrl/cmd +c
          case 67:
            copyTextToClipboard(rowObj[columnObj.title] || '');
            break;
          // // paste ctrl/cmd + v
          // case 86: {
          //   const text = await navigator.clipboard.readText()
          //   this.$set(rowObj, columnObj.title, text)
          // }
          // break
        }
      }

      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      if (e.key && e.key.length === 1) {
        if (!this.isPkAvail && !this.data[this.selected.row].rowMeta.new) {
          return this.$toast.info("Update not allowed for table which doesn't have primary Key").goAway(3000);
        }

        this.$set(this.data[this.selected.row].row, this.availableColumns[this.selected.col].title, '');
        this.editEnabled = { ...this.selected };
      }
    }
  }
},
*/
</script>

<template>
  <div class="flex flex-col h-100 min-h-0 w-100">
    <a-dropdown v-model:visible="contextMenu" :trigger="['contextmenu']">
      <div class="nc-grid-wrapper min-h-0 flex-1 scrollbar-thin-primary">
        <table class="xc-row-table nc-grid backgroundColorDefault" @contextmenu.prevent="contextMenu = true">
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
          <tr v-for="(row, rowIndex) in data" :key="rowIndex" class="nc-grid-row group">
            <td key="row-index" class="caption nc-grid-cell">
              <div class="align-center flex w-[80px]">
                <div class="group-hover:hidden" :class="{ hidden: row.rowMeta.selected }">{{ rowIndex + 1 }}</div>
                <div
                  :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }"
                  class="group-hover:flex w-full align-center"
                >
                  <a-checkbox v-model:checked="row.rowMeta.selected" />
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
                  active: !isPublicView && selected.col === colIndex && selected.row === rowIndex,
                }"
              :data-col="columnObj.id"
              @click="selectCell(rowIndex, colIndex)"
              @dblclick="editEnabled = true"
              @contextmenu="contextMenuTarget = { row: rowIndex, col: colIndex }"
            >
              <SmartsheetVirtualCell v-if="isVirtualCol(columnObj)" v-model="row.row[columnObj.title]"
                                     :column="columnObj" />

              <SmartsheetCell
                v-else
                v-model="row.row[columnObj.title]"
                :column="columnObj"
                :edit-enabled="editEnabled && selected.col === colIndex && selected.row === rowIndex"
                @update:model-value="updateOrSaveRow(row, columnObj.title)"
              />
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
      <template #overlay>
        <div class="bg-white shadow">
          <div v-if="contextMenuTarget" class="nc-menu-item" @click="deleteRow(contextMenuTarget.row)">Delete row</div>
          <div class="nc-menu-item" @click="deleteSelectedRows">Delete all selected rows</div>
          <div v-if="contextMenuTarget" class="nc-menu-item">Clear cell</div>
          <div v-if="contextMenuTarget" class="nc-menu-item" @click="addEmptyRow(contextMenuTarget.row + 1)">Insert new
            row
          </div>
        </div>
      </template>
    </a-dropdown>
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
    background: #0040bc /*var(--v-primary-base)*/
  ;
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
