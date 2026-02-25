<script setup lang="ts">
import {
  type ColumnType,
  type LinkToAnotherRecordType,
  RelationTypes,
  type TableType,
  isLinksOrLTAR,
  isVirtualCol,
} from 'nocodb-sdk'
import { flip, offset, shift, useFloating } from '@floating-ui/vue'
import Scroller from '../grid/canvas/components/Scroller.vue'
import Tooltip from '../grid/canvas/components/Tooltip.vue'
import { useCanvasOutline } from './composables/useCanvasOutline'

const { meta, view } = useSmartsheetStoreOrThrow()
const { metas, getMeta } = useMetas()
const { $api } = useNuxtApp()

const route = useRoute()
const router = useRouter()

const rowHeightEnum = computed(() => {
  const outlineView = view.value?.view as OutlineType | undefined
  if (outlineView?.row_height !== undefined) {
    switch (outlineView.row_height) {
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

const { isConfigured } = useOutlineViewStoreOrThrow()

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
} = useCanvasOutline({
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

const { displayLevels } = useOutlineViewStoreOrThrow()

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

        const btCol = depthMeta.columns?.find((c: ColumnType) => {
          if (!isLinksOrLTAR(c)) return false
          const colOpt = c.colOptions as LinkToAnotherRecordType
          if (!colOpt) return false
          return (
            colOpt.fk_related_model_id === parentDepthMeta!.id &&
            (colOpt.type === RelationTypes.BELONGS_TO || colOpt.type === 'bt') &&
            colOpt.fk_child_column_id === hmColOpt.fk_child_column_id
          )
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
      triggerRefreshCanvas()
    }
  } catch (e: any) {
    console.error('Failed to save cell:', e)
    message.error(e.message || 'Failed to save')
  }
}

async function savePendingCell() {
  const save = pendingSave
  pendingSave = null
  if (!save?.cell || !save?.row) return

  await saveRowProperty(save.cell!, save.row, save.cell!.column.title)
}
</script>

<template>
  <div ref="wrapperRef" class="flex flex-col w-full h-full nc-outline-view-wrapper bg-nc-bg-gray-extralight">
    <div v-if="!isConfigured" class="flex flex-col items-center justify-center h-full gap-6 p-8">
      <GeneralIcon class="text-nc-content-orange-dark w-16 h-16" icon="alertTriangleSolid" />
      <div class="text-xl font-semibold text-nc-content-gray">Hierarchy Not Configured</div>
      <div class="text-sm text-nc-content-gray-muted">
        Use <span class="font-medium text-nc-content-gray">Set Levels</span> in the toolbar to configure your outline view
        hierarchy.
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
              oncontextmenu="return false"
              @mousedown="handleCanvasMouseDown"
              @click="handleCanvasClick"
              @mousemove="handleCanvasMouseMove"
              @mouseleave="handleCanvasMouseLeave"
            />
            <template #overlay>
              <NcMenu>
                <NcMenuItem> This is context menu </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>

          <div
            v-if="activeCell && activeCellRow"
            :style="activeCellStyle"
            class="nc-outline-active-cell pointer-events-auto rounded bg-nc-bg-default"
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
.nc-outline-active-cell {
  box-shadow: 0px 0px 1px rgba(0, 0, 0, 0.32), 0px 0px 3px rgba(0, 0, 0, 0.11), 0px 1px 4px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--nc-border-gray-medium);
  display: flex;
  align-items: center;
  padding: 0 8px;
  overflow: hidden;
}
</style>
