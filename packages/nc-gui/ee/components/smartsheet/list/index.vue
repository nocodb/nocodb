<script setup lang="ts">
import {
  type ColumnType,
  type LinkToAnotherRecordType,
  PermissionEntity,
  PermissionKey,
  RelationTypes,
  type TableType,
  isLinksOrLTAR,
  isVirtualCol,
} from 'nocodb-sdk'
import { flip, offset, shift, useFloating } from '@floating-ui/vue'
import { useCanvasListView } from './composables/useCanvasListView'
import Scroller from '~/components/smartsheet/grid/canvas/components/Scroller.vue'
import Tooltip from '~/components/smartsheet/grid/canvas/components/Tooltip.vue'

const { meta, view } = useSmartsheetStoreOrThrow()
const { metas, getMeta } = useMetas()
const { $api, $e } = useNuxtApp()

const route = useRoute()
const router = useRouter()

const rowHeightEnum = computed(() => {
  const listView = view.value?.view as ListType | undefined
  if (listView?.row_height !== undefined) {
    switch (listView.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
      default:
        return 1
    }
  }
  return 1
})

provide(IsCanvasInjectionInj, true)
provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(IsListInj, ref(true))
provide(RowHeightInj, rowHeightEnum)

const scrollTop = ref(0)
const scrollLeft = ref(0)
const wrapperRef = ref()
const activeCellRow = ref<Row | null>(null)

const mousePosition = reactive({ x: 0, y: 0 })
const clientMousePosition = reactive(clientMousePositionDefaultValue)
const scroller = ref()
provide(ClientMousePositionInj, clientMousePosition)

const isContextMenuOpen = ref(false)

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const isPublicView = inject(IsPublicInj, ref(false))

const { height, width } = useElementSize(wrapperRef)
const tooltipStore = useTooltipStore()
const { targetReference, placement } = storeToRefs(tooltipStore)
const tooltipRef = ref()
const { floatingStyles } = useFloating(targetReference, tooltipRef, {
  placement,
  middleware: [offset(8), flip(), shift({ padding: 5 })],
})

const { isConfigured } = useListViewStoreOrThrow()

const {
  canvasRef,
  triggerRefreshCanvas,
  resetAndReload,
  totalHeight,
  totalWidth,
  handleCanvasMouseDown,
  handleCanvasClick,
  handleCanvasMouseMove,
  handleCanvasMouseLeave,
  onExpandRow,
  onAddRow,
  activeCell,
  cachedRows,
  handleRowSaved,
  contextMenuTarget,
  handleContextMenu,
  getMetaForDepth: getMetaForDepthFromComposable,
} = useCanvasListView({
  scrollLeft,
  scrollTop,
  width,
  height,
  mousePosition,
})

function handleScroll({ left, top }: { left: number; top: number }) {
  scrollLeft.value = left
  scrollTop.value = top
  if (activeCell.value) {
    activeCell.value = null
  }
}

reloadViewDataHook.on(() => {
  resetAndReload()
})

const { displayLevels } = useListViewStoreOrThrow()

const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()
const expandedFormMeta = ref<TableType>()

function getMetaForDepth(depth: number): TableType | undefined {
  const level = displayLevels.value[depth]
  if (!level?.fk_model_id) return undefined
  const baseId = meta.value?.base_id
  const metaKey = `${baseId}:${level.fk_model_id}`
  return metas.value?.[metaKey] as TableType | undefined
}

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(val) {
    if (!val) {
      expandedFormMeta.value = undefined
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
    }
  },
})

function expandForm(row: Row, state?: Record<string, any>) {
  const rowMeta = expandedFormMeta.value || meta.value
  const rowId = extractPkFromRow(row.row, rowMeta!.columns as ColumnType[])
  expandedFormRowState.value = state

  if (rowId && !isPublicView.value) {
    expandedFormRow.value = undefined
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
  }
}

onExpandRow(async ({ row, depth }) => {
  $e('a:list:expand-record')

  let depthMeta = getMetaForDepth(depth)
  if (!depthMeta) {
    const level = displayLevels.value[depth]
    if (level?.fk_model_id) {
      const baseId = meta.value?.base_id
      depthMeta = (await getMeta(level.fk_model_id, false, false, baseId)) as TableType | undefined
    }
  }
  expandedFormMeta.value = depthMeta

  const rowObj: Row = {
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }
  expandForm(rowObj)
})

onAddRow(async ({ depth, parentPk }) => {
  if (isDataReadOnly.value || isPublicView.value) return
  $e('c:list:add-record')

  let depthMeta = getMetaForDepth(depth)
  if (!depthMeta) {
    const level = displayLevels.value[depth]
    if (level?.fk_model_id) {
      const baseId = meta.value?.base_id
      depthMeta = (await getMeta(level.fk_model_id, false, false, baseId)) as TableType | undefined
    }
  }
  if (!depthMeta) return

  expandedFormMeta.value = depthMeta

  const newRow: Row = {
    row: {},
    oldRow: {},
    rowMeta: { new: true },
  }

  if (parentPk !== undefined && depth > 0) {
    const parentLevel = displayLevels.value[depth - 1]
    let parentDepthMeta = getMetaForDepth(depth - 1)
    if (!parentDepthMeta && parentLevel?.fk_model_id) {
      parentDepthMeta = (await getMeta(parentLevel.fk_model_id, false, false, meta.value?.base_id)) as TableType | undefined
    }

    if (parentLevel?.fk_link_column_id && parentDepthMeta) {
      const hmCol = parentDepthMeta.columns?.find((c: ColumnType) => c.id === parentLevel.fk_link_column_id)
      if (hmCol) {
        const hmColOpt = hmCol.colOptions as LinkToAnotherRecordType

        // Find the reverse link column on the child table (BT for hm, MO for om)
        const btCol = depthMeta.columns?.find((c: ColumnType) => {
          if (!isLinksOrLTAR(c)) return false
          const colOpt = c.colOptions as LinkToAnotherRecordType
          if (!colOpt) return false
          if (colOpt.fk_related_model_id !== parentDepthMeta!.id) return false

          // hm/bt pair: both share the same fk_child_column_id (the FK column)
          if (
            (colOpt.type === RelationTypes.BELONGS_TO || colOpt.type === 'bt') &&
            colOpt.fk_child_column_id === hmColOpt.fk_child_column_id
          ) {
            return true
          }

          // om/mo pair: both share the same junction table (fk_mm_model_id)
          if (
            (colOpt.type === RelationTypes.MANY_TO_ONE || colOpt.type === 'mo') &&
            hmColOpt.fk_mm_model_id &&
            colOpt.fk_mm_model_id === hmColOpt.fk_mm_model_id
          ) {
            return true
          }

          return false
        })

        if (btCol?.title) {
          const parentPkCols = parentDepthMeta.columns?.filter((c: ColumnType) => c.pk) ?? []
          const parentPvCol = parentDepthMeta.columns?.find((c: ColumnType) => c.pv)
          const pkValues = parentPk.toString().split('___')
          const parentRowRef: Record<string, any> = {}
          parentPkCols.forEach((col: ColumnType, i: number) => {
            parentRowRef[col.title!] = pkValues[i] ?? parentPk
          })
          if (parentPvCol?.title && !(parentPvCol.title in parentRowRef)) {
            parentRowRef[parentPvCol.title] = parentPk
          }

          newRow.row[btCol.title] = parentRowRef
          expandedFormRowState.value = { [btCol.title]: parentRowRef }
          expandedFormRow.value = newRow
          expandedFormDlg.value = true
          return
        }
      }
    }
  }

  expandedFormRow.value = newRow
  expandedFormRowState.value = undefined
  expandedFormDlg.value = true
})

const activeCellStyle = computed(() => {
  if (!activeCell.value) return {}
  return {
    position: 'absolute' as const,
    top: `${activeCell.value.y}px`,
    left: `${activeCell.value.x}px`,
    width: `${activeCell.value.width}px`,
    height: `${activeCell.value.height}px`,
    zIndex: 10,
  }
})

function onCellValueUpdate(val: any) {
  if (!activeCell.value || !activeCellRow.value) return
  activeCellRow.value.row[activeCell.value.column.title] = val
}

let pendingSave: {
  cell: typeof activeCell.value
  row: Row
} | null = null

watch(activeCell, (newVal, oldVal) => {
  if (oldVal && activeCellRow.value) {
    pendingSave = {
      cell: { ...oldVal },
      row: JSON.parse(JSON.stringify(activeCellRow.value)),
    }
    savePendingCell()
  }

  if (newVal) {
    activeCellRow.value = {
      row: { ...newVal.row },
      oldRow: { ...newVal.row },
      rowMeta: {},
    }
  } else {
    activeCellRow.value = null
  }
})

async function onVirtualCellSave(rowObj: Row, property: string) {
  if (!activeCell.value) return
  await saveRowProperty(activeCell.value, rowObj, property)
}

async function onCellSave() {
  if (!activeCell.value || !activeCellRow.value) return
  await saveRowProperty(activeCell.value, activeCellRow.value, activeCell.value.column.title)
}

async function saveRowProperty(cell: NonNullable<typeof activeCell.value>, rowObj: Row, property: string) {
  if (isDataReadOnly.value || isPublicView.value) return

  const newVal = rowObj.row[property]
  const oldVal = rowObj.oldRow[property]

  if (newVal === oldVal) return

  const depthMeta = getMetaForDepth(cell.depth)
  if (!depthMeta) return

  const rowId = extractPkFromRow(rowObj.row, depthMeta.columns as ColumnType[])
  if (!rowId) return

  try {
    const updatedRowData = await $api.dbTableRow.update(
      NOCO,
      depthMeta.base_id as string,
      depthMeta.id as string,
      encodeURIComponent(rowId),
      {
        [property]: newVal ?? null,
      },
    )

    const cached = cachedRows.value.get(cell.rowIndex)
    if (cached) {
      Object.assign(cached, updatedRowData)
      handleRowSaved(cell.rowIndex, property)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function savePendingCell() {
  const save = pendingSave
  pendingSave = null
  if (!save?.cell || !save?.row) return

  await saveRowProperty(save.cell!, save.row, save.cell!.column.title)
}

const { isDataReadOnly, isUIAllowed } = useRoles()
const { isAllowed: isFieldAllowed } = usePermissions()
const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())
const { copy } = useCopy()

const isSyncedTable = computed(() => !!meta.value?.synced)

function contextExpandRecord() {
  const target = contextMenuTarget.value
  if (!target) return

  const depthMeta = getMetaForDepthFromComposable(target.depth) || getMetaForDepth(target.depth)
  expandedFormMeta.value = depthMeta

  const rowObj: Row = { row: { ...target.row }, oldRow: { ...target.row }, rowMeta: {} }
  expandForm(rowObj)
  isContextMenuOpen.value = false
}

async function contextCopyCell() {
  const target = contextMenuTarget.value
  if (!target?.column) return

  const val = target.row[target.column.title]
  await copy(val != null ? String(val) : '')
  message.success('Copied to clipboard')
  isContextMenuOpen.value = false
}

async function contextClearCell() {
  const target = contextMenuTarget.value
  if (!target?.column || target.column.readonly || isDataReadOnly.value || isPublicView.value || isSyncedTable.value) return

  const depthMeta = getMetaForDepthFromComposable(target.depth) || getMetaForDepth(target.depth)
  if (!depthMeta) return

  const rowId = extractPkFromRow(target.row, depthMeta.columns as ColumnType[])
  if (!rowId) return

  try {
    const property = target.column.title
    await $api.dbTableRow.update(NOCO, depthMeta.base_id as string, depthMeta.id as string, encodeURIComponent(rowId), {
      [property]: null,
    })

    const cached = cachedRows.value.get(target.rowIndex)
    if (cached) {
      cached[property] = null
      handleRowSaved(target.rowIndex, property)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  isContextMenuOpen.value = false
}

async function contextDeleteRow() {
  const target = contextMenuTarget.value
  if (!target || isDataReadOnly.value || isPublicView.value || isSyncedTable.value) return

  const depthMeta = getMetaForDepthFromComposable(target.depth) || getMetaForDepth(target.depth)
  if (!depthMeta) return

  const rowId = extractPkFromRow(target.row, depthMeta.columns as ColumnType[])
  if (!rowId) return

  try {
    await $api.dbTableRow.delete(NOCO, depthMeta.base_id as string, depthMeta.id as string, encodeURIComponent(rowId))

    // Socket event handles proper cache removal + parent pruning.
    // Force a reload for instant feedback.
    resetAndReload()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  isContextMenuOpen.value = false
}

function contextAddComment() {
  const target = contextMenuTarget.value
  if (!target) return

  isExpandedFormCommentMode.value = true
  contextExpandRecord()
}
</script>

<template>
  <div ref="wrapperRef" class="flex flex-col w-full h-full nc-list-view-wrapper bg-nc-bg-gray-extralight">
    <div v-if="!isConfigured" class="flex flex-col items-center justify-center h-full gap-6 p-8">
      <GeneralIcon class="text-nc-content-orange-dark w-16 h-16" icon="alertTriangleSolid" />
      <div class="text-xl font-semibold text-nc-content-gray">Hierarchy Not Configured</div>
      <div class="text-sm text-nc-content-gray-muted">
        Use <span class="font-medium text-nc-content-gray">Set Levels</span> in the toolbar to configure your list view hierarchy.
      </div>
    </div>

    <template v-else>
      <Scroller
        ref="scroller"
        class="relative flex-1"
        :scroll-height="totalHeight"
        :scroll-width="totalWidth"
        :height="height"
        :width="width"
        :inset="50"
        @scroll="handleScroll"
      >
        <div
          class="sticky top-0 left-0"
          :style="{
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
          }"
        >
          <Teleport to="body">
            <Transition name="tooltip">
              <Tooltip v-if="tooltipStore.tooltipText" ref="tooltipRef" :tooltip-style="floatingStyles" />
            </Transition>
          </Teleport>
          <NcDropdown
            v-model:visible="isContextMenuOpen"
            :trigger="['contextmenu']"
            overlay-class-name="nc-dropdown-grid-context-menu"
          >
            <canvas
              ref="canvasRef"
              class="sticky top-0 left-0"
              :height="`${height}px`"
              :width="`${width}px`"
              @mousedown="handleCanvasMouseDown"
              @click="handleCanvasClick"
              @mousemove="handleCanvasMouseMove"
              @mouseleave="handleCanvasMouseLeave"
              @contextmenu.prevent="handleContextMenu"
            />
            <template #overlay>
              <NcMenu v-if="contextMenuTarget" class="!rounded !py-0" variant="small">
                <!-- Expand record — always available -->
                <NcMenuItem key="expand-record" data-testid="nc-list-context-expand" @click="contextExpandRecord">
                  <div v-e="['c:list:context:expand']" class="flex gap-2 items-center">
                    <GeneralIcon icon="expand" />
                    {{ $t('activity.expandRecord') }}
                  </div>
                </NcMenuItem>

                <NcDivider />

                <!-- Copy cell — when right-clicked on a cell -->
                <NcMenuItem
                  v-if="contextMenuTarget.column"
                  key="copy-cell"
                  data-testid="nc-list-context-copy"
                  @click="contextCopyCell"
                >
                  <div v-e="['c:list:context:copy']" class="flex gap-2 items-center">
                    <GeneralIcon icon="copy" />
                    {{ $t('general.copy') }} {{ $t('objects.cell').toLowerCase() }}
                  </div>
                </NcMenuItem>

                <!-- Clear cell — with field-level permission check -->
                <PermissionsTooltip
                  v-if="
                    contextMenuTarget.column &&
                    !isDataReadOnly &&
                    !isPublicView &&
                    !isSyncedTable &&
                    (!contextMenuTarget.column.virtual || isLinksOrLTAR(contextMenuTarget.column.columnObj))
                  "
                  :entity="PermissionEntity.FIELD"
                  :entity-id="contextMenuTarget.column.columnObj?.id"
                  :permission="PermissionKey.RECORD_FIELD_EDIT"
                  placement="right"
                >
                  <template #default="{ isAllowed }">
                    <NcMenuItem
                      key="clear-cell"
                      data-testid="nc-list-context-clear"
                      :disabled="!isAllowed || contextMenuTarget.column.readonly"
                      @click="contextClearCell"
                    >
                      <div v-e="['c:list:context:clear']" class="flex gap-2 items-center">
                        <GeneralIcon icon="close" />
                        {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
                      </div>
                    </NcMenuItem>
                  </template>
                </PermissionsTooltip>

                <!-- Add comment — non-public, has comment permission -->
                <template v-if="!isPublicView && isUIAllowed('commentEdit')">
                  <NcDivider />
                  <NcMenuItem key="add-comment" data-testid="nc-list-context-comment" @click="contextAddComment">
                    <div v-e="['c:list:context:comment']" class="flex gap-2 items-center">
                      <GeneralIcon icon="ncComment" />
                      {{ $t('general.add') }} {{ $t('general.comment').toLowerCase() }}
                    </div>
                  </NcMenuItem>
                </template>

                <!-- Delete row — with table-level permission check -->
                <template v-if="!isPublicView && !isSyncedTable && isUIAllowed('dataEdit') && !isDataReadOnly">
                  <NcDivider />
                  <PermissionsTooltip
                    :entity="PermissionEntity.TABLE"
                    :entity-id="meta?.id"
                    :permission="PermissionKey.TABLE_RECORD_DELETE"
                    placement="right"
                  >
                    <template #default="{ isAllowed }">
                      <NcMenuItem
                        key="delete-row"
                        danger
                        data-testid="nc-list-context-delete"
                        :disabled="!isAllowed"
                        @click="contextDeleteRow"
                      >
                        <div v-e="['c:list:context:delete']" class="flex gap-2 items-center">
                          <GeneralIcon icon="delete" />
                          {{ $t('activity.deleteRow') }}
                        </div>
                      </NcMenuItem>
                    </template>
                  </PermissionsTooltip>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>

          <div
            v-if="activeCell && activeCellRow"
            :style="activeCellStyle"
            class="nc-list-active-cell pointer-events-auto rounded bg-nc-bg-default"
          >
            <SmartsheetRow :row="activeCellRow">
              <template #default>
                <SmartsheetVirtualCell
                  v-if="isVirtualCol(activeCell.column.columnObj)"
                  v-model="activeCellRow.row[activeCell.column.title]"
                  :column="activeCell.column.columnObj"
                  :row="activeCellRow"
                  active
                  @save="onVirtualCellSave"
                />
                <SmartsheetCell
                  v-else
                  :model-value="activeCellRow.row[activeCell.column.title]"
                  :column="activeCell.column.columnObj"
                  active
                  edit-enabled
                  @update:model-value="onCellValueUpdate"
                  @save="onCellSave"
                />
              </template>
            </SmartsheetRow>
          </div>
        </div>
      </Scroller>
    </template>
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :load-row="!isPublicView"
      :state="expandedFormRowState"
      :meta="expandedFormMeta || meta"
      use-meta-fields
    />
  </Suspense>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && (expandedFormMeta?.id || meta?.id)"
      v-model="expandedFormOnRowIdDlg"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="expandedFormMeta || meta"
      :load-row="!isPublicView"
      :row-id="route.query.rowId"
      :expand-form="expandForm"
      use-meta-fields
    />
  </Suspense>
</template>

<style scoped lang="scss">
:deep(.custom-scrollbar-track.vertical) {
  bottom: 4px;
}
:deep(.custom-scrollbar-track.horizontal) {
  bottom: 4px;
}
.nc-list-active-cell {
  box-shadow: 0px 0px 1px rgba(0, 0, 0, 0.32), 0px 0px 3px rgba(0, 0, 0, 0.11), 0px 1px 4px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--nc-border-gray-medium);
  display: flex;
  align-items: center;
  padding: 0 8px;
  overflow: hidden;
}
</style>
