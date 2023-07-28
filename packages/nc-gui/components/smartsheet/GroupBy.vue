<script lang="ts" setup>
import { WorkspaceUserRoles, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsLockedInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  ReadonlyInj,
  ReloadViewDataHookInj,
  createEventHook,
  enumColor,
  iconMap,
  inject,
  isColumnRequiredAndNull,
  ref,
  useI18n,
  useNuxtApp,
  useRoles,
  useUIPermission,
} from '#imports'
import type { Row } from '~/lib'

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { $api, $e } = useNuxtApp()

// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))
const readOnly = inject(ReadonlyInj, ref(false))
const isLocked = inject(IsLockedInj, ref(false))

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const { hasRole } = useRoles()
const { isUIAllowed } = useUIPermission()
const hasEditPermission = $computed(() => isUIAllowed('xcDatatableEditable'))
</script>

<template>
  <div class="flex flex-col my-2">
    <a-collapse v-model:activeKey="activeGroupBy" accordion @change="findAndLoadGroup">
      <a-collapse-panel v-for="group of groupedByData" :key="group.key">
        <template #header>
          <div class="flex items-center">
            <div class="flex flex-col">
              <div class="flex gap-2">
                <div class="text-xs text-gray">{{ group.column_name }}</div>
                <div class="text-xs text-gray">(Count: {{ group.count }})</div>
              </div>
              <div class="flex mt-1">
                <a-tag class="!py-0 !px-[12px] !rounded-[12px]">
                  <span>
                    {{ group.key }}
                  </span>
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        <table class="xc-group-table nc-grid backgroundColorDefault !h-auto bg-white" @contextmenu="showContextMenu">
          <tbody ref="tableBodyEl">
            <LazySmartsheetRow v-for="(row, rowIndex) of group.row" ref="rowRefs" :key="rowIndex" :row="row">
              <template #default="{ state }">
                <tr
                  class="nc-grid-row"
                  :style="{ height: rowHeight ? `${rowHeight * 1.8}rem` : `1.8rem` }"
                  :data-testid="`grid-row-${rowIndex}`"
                >
                  <td
                    key="row-index"
                    class="caption nc-grid-cell pl-5 pr-1"
                    :data-testid="`cell-Id-${rowIndex}`"
                    @contextmenu="contextMenuTarget = null"
                  >
                    <div class="items-center flex gap-1 min-w-[60px]">
                      <div
                        v-if="!readOnly || !isLocked"
                        class="nc-row-no text-xs text-gray-500"
                        :class="{ toggle: !readOnly, hidden: row.rowMeta.selected }"
                      >
                        {{ ((paginationData.page ?? 1) - 1) * (paginationData.pageSize ?? 25) + rowIndex + 1 }}
                      </div>
                      <div
                        v-if="!readOnly"
                        :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }"
                        class="nc-row-expand-and-checkbox"
                      >
                        <a-checkbox v-model:checked="row.rowMeta.selected" />
                      </div>
                      <span class="flex-1" />

                      <div
                        v-if="
                          !readOnly ||
                          hasRole('commenter', true) ||
                          hasRole('viewer', true) ||
                          hasRole(WorkspaceUserRoles.COMMENTER, true) ||
                          hasRole(WorkspaceUserRoles.VIEWER, true)
                        "
                        class="nc-expand"
                        :data-testid="`nc-expand-${rowIndex}`"
                        :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                      >
                        <a-spin
                          v-if="row.rowMeta.saving"
                          class="!flex items-center"
                          :data-testid="`row-save-spinner-${rowIndex}`"
                        />
                        <template v-else-if="!isLocked">
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
                            class="cursor-pointer flex items-center border-1 border-gray-100 active:ring rounded p-1 hover:(bg-gray-50)"
                          >
                            <component
                              :is="iconMap.expand"
                              v-e="['c:row-expand']"
                              class="select-none transform hover:(text-black scale-120) nc-row-expand"
                              @click="expandForm(row, state)"
                            />
                          </div>
                        </template>
                      </div>
                    </div>
                  </td>
                  <SmartsheetTableDataCell
                    v-for="(columnObj, colIndex) of fields"
                    :key="columnObj.id"
                    ref="cellRefs"
                    class="cell relative nc-grid-cell"
                    :class="{
                      'cursor-pointer': hasEditPermission,
                      'active': hasEditPermission && isCellSelected(rowIndex, colIndex),
                      'active-cell':
                        hasEditPermission &&
                        ((activeCell.row === rowIndex && activeCell.col === colIndex) ||
                          (selectedRange._start?.row === rowIndex && selectedRange._start?.col === colIndex)),
                      'nc-required-cell': isColumnRequiredAndNull(columnObj, row.row),
                      'align-middle': !rowHeight || rowHeight === 1,
                      'align-top': rowHeight && rowHeight !== 1,
                      'filling': isCellInFillRange(rowIndex, colIndex),
                    }"
                    :data-testid="`cell-${columnObj.title}-${rowIndex}`"
                    :data-key="rowIndex + columnObj.id"
                    :data-col="columnObj.id"
                    :data-title="columnObj.title"
                    :data-row-index="rowIndex"
                    :data-col-index="colIndex"
                    @mousedown="handleMouseDown($event, rowIndex, colIndex)"
                    @mouseover="handleMouseOver($event, rowIndex, colIndex)"
                    @click="handleCellClick($event, rowIndex, colIndex)"
                    @dblclick="makeEditable(row, columnObj)"
                    @contextmenu="showContextMenu($event, { row: rowIndex, col: colIndex })"
                  >
                    <div v-if="!switchingTab" class="w-full h-full">
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(columnObj)"
                        v-model="row.row[columnObj.title]"
                        :column="columnObj"
                        :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                        :row="row"
                        :read-only="readOnly"
                        @navigate="onNavigate"
                        @save="updateOrSaveRow(row, '', state)"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="row.row[columnObj.title]"
                        :column="columnObj"
                        :edit-enabled="
                          !!hasEditPermission && !!editEnabled && activeCell.col === colIndex && activeCell.row === rowIndex
                        "
                        :row-index="rowIndex"
                        :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                        :read-only="readOnly"
                        @update:edit-enabled="editEnabled = $event"
                        @save="updateOrSaveRow(row, columnObj.title, state)"
                        @navigate="onNavigate"
                        @cancel="editEnabled = false"
                      />
                    </div>
                  </SmartsheetTableDataCell>
                </tr>
              </template>
            </LazySmartsheetRow>

            <tr
              v-if="isAddingEmptyRowAllowed"
              v-e="['c:row:add:grid-bottom']"
              class="text-left nc-grid-add-new-cell cursor-pointer group relative z-3"
              :class="{
                '!border-r-2 !border-r-gray-100': visibleColLength === 1,
              }"
              @mouseup.stop
              @click="addEmptyRow()"
            >
              <td class="text-left pointer sticky left-0 !border-r-0">
                <div class="px-2 w-full flex items-center text-gray-500">
                  <component :is="iconMap.plus" class="text-pint-500 text-xs ml-2 text-gray-600 group-hover:text-black" />
                </div>
              </td>
              <td class="!border-gray-50" :colspan="visibleColLength"></td>
            </tr>
          </tbody>
        </table>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<style lang="scss">
.nc-pagination-wrapper .ant-dropdown-button {
  > .ant-btn {
    @apply !p-0 !rounded-l-md hover:border-gray-300;
  }

  > .ant-dropdown-trigger {
    @apply !rounded-r-md;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  @apply !rounded-md;
}
</style>

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full overflow-auto;

  .nc-grid-add-edit-column {
    background-color: rgb(252, 252, 252);
  }
  .nc-grid-add-new-cell:hover td {
    background-color: rgb(252, 252, 252);
    @apply text-black;
  }

  td,
  th {
    @apply border-gray-50 border-solid border-r bg-gray-50;
    background-color: rgb(252, 252, 252);
    min-height: 41px !important;
    height: 41px !important;
    position: relative;
  }

  th {
    @apply border-b-1 border-gray-50;
  }

  .nc-grid-header th:last-child {
    @apply !border-b-1;
  }

  td {
    @apply bg-white border-b;
  }

  td:not(:first-child) > div {
    overflow: hidden;
    @apply flex px-1 h-auto;
  }

  table {
    background-color: var(--nc-grid-bg);

    border-collapse: separate;
    border-spacing: 0;
  }

  td {
    text-overflow: ellipsis;
  }

  td.active::after {
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
    @apply text-primary border-current bg-primary bg-opacity-5;
  }

  td.active-cell::after {
    @apply border-1 border-solid text-primary border-current bg-primary bg-opacity-3;
  }

  td.filling::after {
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
  td.filling::after {
    @apply border-1 border-dashed text-primary border-current bg-gray-100 bg-opacity-50;
  }

  //td.active::before {
  //  content: '';
  //  z-index:4;
  //  @apply absolute !w-[10px] !h-[10px] !right-[-5px] !bottom-[-5px] bg-primary;
  //}

  thead th:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 5;
  }

  tbody td:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 4;
    background: white;
  }

  thead th:nth-child(2) {
    position: sticky !important;
    left: 85px;
    z-index: 5;
    @apply border-r-1 border-r-gray-75;
  }

  tbody td:nth-child(2) {
    position: sticky !important;
    left: 85px;
    z-index: 4;
    background: white;
    @apply border-r-1 border-r-gray-75;
  }
}

:deep(.ant-collapse-content-box) {
  @apply !p-0;
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

  @apply z-5 bg-white;

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

.nc-required-cell {
  box-shadow: inset 0 0 2px #f00;
}

.nc-fill-handle {
  @apply w-[6px] h-[6px] absolute rounded-full bg-red-500 !pointer-events-auto mt-[-4px] ml-[-4px];
}

.nc-fill-handle:hover,
.nc-fill-handle:active,
.nc-fill-handle:focus {
  @apply w-[8px] h-[8px] mt-[-5px] ml-[-5px];
}
</style>
