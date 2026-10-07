<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { getMockSession, installPlaygroundMocks, seedPlaygroundStores, unmockedRequests } from '../-helper/install'
import { MOCK_BASE_ID, MOCK_TASKS_TABLE_ID, buildRows, buildTable, buildTasks, buildTasksTable } from '../-helper/mock-data'
import type { MockViewKind } from '../-helper/mock-data'
import { UseDetachedLongTextProvider } from '~/components/smartsheet/grid/canvas/composables/useDetachedLongText'

const props = defineProps<{
  kind: MockViewKind
}>()

// the adapter is normally installed by the route middleware; repeated for HMR remounts
installPlaygroundMocks(props.kind)
seedPlaygroundStores()

const { metas } = useMetas()

const { $eventBus } = useNuxtApp()

const basesStore = useBases()

const { activeView } = storeToRefs(useViewsStore())

const meta = computed<TableType | undefined>(() => metas.value[`${MOCK_BASE_ID}:${props.kind}`])

const { isGallery, isGrid, isForm, isKanban, isCalendar, isMap, isList, isTimeline, isGantt, isLocked, xWhere, eventBus } =
  useProvideSmartsheetStore(activeView, meta)

useViewRowColorProvider({ view: activeView, eventBus })

const expandedFormPanelStore = useProvideExpandedFormPanel()

const route = useRoute()

const reloadViewDataEventHook = createEventHook()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

const activeSource = computed(() => basesStore.bases.get(MOCK_BASE_ID)?.sources?.[0])

useProvideKanbanViewStore(meta, activeView)
useProvideMapViewStore(meta, activeView)
useProvideCalendarViewStore(meta, activeView, false, xWhere)
useProvideListViewStore(meta, activeView)
useProvideTimelineViewStore(meta, activeView, false, xWhere)
useProvideGanttViewStore(meta, activeView, false, xWhere)

provide(MetaInj, meta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, isLocked)
provide(ReloadViewDataHookInj, reloadViewDataEventHook)
provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)
provide(OpenNewRecordFormHookInj, openNewRecordFormHook)
provide(IsFormInj, isForm)
provide(IsTimelineInj, isTimeline)
provide(IsGanttInj, isGantt)
provide(TabMetaInj, ref({ id: props.kind, title: meta.value?.title, type: TabType.TABLE } as TabItem))
provide(ActiveSourceInj, activeSource)
provide(ReloadAggregateHookInj, createEventHook())
provide(ReadonlyInj, ref(false))

useExpandedFormDetachedProvider()
UseDetachedLongTextProvider()

const { loadViewColumns } = useProvideViewColumns(activeView, meta, () => reloadViewDataEventHook?.trigger())

useProvideViewGroupBy(activeView, meta, xWhere)

useProvideSmartsheetLtarHelpers(meta)

const isReady = computed(() => !!meta.value && activeView.value?.id === `vw-pg-${props.kind}`)

const componentName = computed(
  () =>
    ({
      grid: 'SmartsheetGrid',
      gallery: 'SmartsheetGallery',
      kanban: 'SmartsheetKanbanOptimized',
      calendar: 'SmartsheetCalendar',
      form: 'SmartsheetForm',
      map: 'SmartsheetMap',
      list: 'SmartsheetList',
      timeline: 'SmartsheetTimeline',
      gantt: 'SmartsheetGantt',
    }[props.kind]),
)

const rowCount = computed(() => getMockSession()?.db.rows.length ?? 0)

const unmockedLabel = computed(
  () => `${unmockedRequests.value.length} unmocked request${unmockedRequests.value.length === 1 ? '' : 's'}`,
)

const headerNote = computed(() => {
  if (route.query.rowId) return `with record #${route.query.rowId} expanded`
  if (props.kind === 'map') return 'map tiles load from the configured tile server'
  return ''
})

async function resetData() {
  const db = getMockSession()?.db
  if (!db) return
  const table = buildTable(props.kind)
  const tasksTable = buildTasksTable()
  db.tables[table.id!] = table
  db.tables[tasksTable.id!] = tasksTable
  metas.value = {
    ...metas.value,
    [`${MOCK_BASE_ID}:${table.id}`]: table,
    [`${MOCK_BASE_ID}:${MOCK_TASKS_TABLE_ID}`]: tasksTable,
  }
  db.rows.splice(0, db.rows.length, ...buildRows())
  db.tasks.splice(0, db.tasks.length, ...buildTasks(db.rows))
  db.audits.splice(0, db.audits.length)
  db.filters.splice(0, db.filters.length)
  db.sorts.splice(0, db.sorts.length)
  db.viewColumnPatches = {}
  db.rowColors = {}
  eventBus.emit(SmartsheetStoreEvents.FILTER_RELOAD)
  eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
  eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
  await loadViewColumns()
  reloadViewMetaEventHook.trigger()
  reloadViewDataEventHook.trigger()
}

// stands in for the realtime column_add/update/delete event (useRealtime.ts), which has no socket here
watch(
  () => meta.value?.columns?.map((c) => `${c.id}:${c.title}:${c.uidt}`).join(),
  (next, prev) => {
    if (!prev || next === prev) return
    $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
  },
)

defineExpose({ reload: () => reloadViewDataEventHook.trigger(), resetData })
</script>

<template>
  <div class="nc-pg-view-harness h-full flex flex-col min-h-0">
    <div class="flex-none flex items-center gap-2 px-3 h-9 border-b-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight">
      <GeneralIcon icon="ncInfo" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
      <span class="text-captionSm text-nc-content-gray-subtle">
        Real <code>{{ componentName }}</code> on {{ rowCount }} in-memory rows{{ headerNote ? `, ${headerNote}` : '' }} — edits
        stay in this tab.
      </span>
      <slot name="controls" />
      <div class="ml-auto flex items-center gap-2">
        <NcDropdown v-if="unmockedRequests.length" placement="bottomRight">
          <NcButton size="xxsmall" type="secondary" class="!px-2">
            <span class="text-captionXs text-nc-content-orange-dark">{{ unmockedLabel }}</span>
          </NcButton>
          <template #overlay>
            <div class="p-2 max-w-[520px] max-h-[360px] overflow-auto nc-scrollbar-thin">
              <div
                v-for="req in unmockedRequests"
                :key="`${req.method}${req.url}${req.operation}`"
                class="text-captionXs font-mono py-0.5"
              >
                <span class="text-nc-content-gray-muted">{{ req.method }}</span>
                {{ req.url }}
                <span v-if="req.operation" class="text-nc-content-brand">?operation={{ req.operation }}</span>
              </div>
            </div>
          </template>
        </NcDropdown>
        <NcButton size="xxsmall" type="text" class="!px-2" @click="resetData">
          <span class="text-captionXs">Reset data</span>
        </NcButton>
      </div>
    </div>

    <template v-if="isReady">
      <div class="flex-1 min-h-0 flex flex-row">
        <div v-show="!expandedFormPanelStore.isFullscreen.value" class="flex-1 min-w-0 flex flex-col">
          <SmartsheetToolbar v-if="!isForm && !isGantt" class="flex-none" />
          <div class="flex-1 min-h-0 flex flex-col relative bg-nc-bg-default">
            <SmartsheetGrid v-if="isGrid" />
            <SmartsheetGallery v-else-if="isGallery" />
            <SmartsheetForm v-else-if="isForm" />
            <LazySmartsheetKanbanOptimized v-else-if="isKanban" />
            <SmartsheetCalendar v-else-if="isCalendar" />
            <SmartsheetTimeline v-else-if="isTimeline" />
            <SmartsheetGantt v-else-if="isGantt" />
            <SmartsheetMap v-else-if="isMap" />
            <SmartsheetList v-else-if="isList" />
          </div>
        </div>
        <SmartsheetGridExpandedFormPanel v-if="expandedFormPanelStore.isOpen.value && isGrid" />
      </div>
      <LazySmartsheetExpandedFormDetached />
    </template>
    <div v-else class="flex-1 flex items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>
