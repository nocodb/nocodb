<script lang="ts" setup>
import { type ColumnType, PermissionEntity, PermissionKey, UITypes } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { user, isMobileMode } = useGlobal()

const { isAllowed } = usePermissions()

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isPublic = inject(IsPublicInj, ref(false))

// Interface pages with a "new record" form configured route inline add through
// this handler (opens the configured form seeded with the clicked date) instead
// of the default expanded-record form. Null elsewhere → falls back to expand.
const interfaceNewRecordForm = inject(InterfaceNewRecordFormInj, ref<((prefill: Record<string, any>) => boolean) | null>(null))

// Interface pages open their record-detail sheet instead of the expanded form.
const interfaceExpandRecord = inject(InterfaceExpandRecordInj, undefined)

// Interface pages expose row insert/delete for the record right-click menu.
const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

// Whether the interface viz opens records — gates the context-menu Expand item.
const interfaceClickIntoDetails = inject(InterfaceClickIntoDetailsInj, ref(true))

// Calendar date cells render lookup fields through the flat PlainCell path,
// which only reads the metas cache. Preload the related-table metas for every
// visible lookup chain so a lookup-of-a-lookup resolves on a direct URL /
// refresh — without it those cells render empty or as "[object Object]".
useLoadLookupMetas(meta, { enabled: computed(() => !isPublic.value) })

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const { allFilters, validFiltersFromUrlParams, isSyncedTable } = useSmartsheetStoreOrThrow()
const {
  activeCalendarView, // The active Calendar View - "week" | "day" | "month" | "year"
  calendarRange, // calendar Ranges
  calDataType, // Calendar Data Type
  loadCalendarData, // Function to load Calendar Data
  loadSidebarData, // Function to load Sidebar Data
  isCalendarDataLoading, // Boolean ref to check if Calendar Data is Loading
  fetchActiveDates, // Function to fetch Active Dates
  showSideMenu, // Boolean Ref to show Side Menu
  recordHeightMode, // 'compact' (default) | 'expanded'
  isDayAnchoredMode, // '3day' or custom + day-unit → WeekView with N day columns
  isMultiWeekRange, // 2week / 6week / custom + week-unit → MonthView with N week rows
  isAddDeleteInlineEnabled, // interface add/delete opt-in (true outside interfaces)
} = useCalendarViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const { copy } = useCopy()

const { t } = useI18n()

// In Expanded mode the week/multi-week and month grids grow beyond the viewport to show
// every record, so the calendar body becomes the vertical scroll container.
const isHeightExpanded = computed(
  () =>
    recordHeightMode.value === 'expanded' &&
    ['week', '3day', '2week', 'month', '6week', 'custom'].includes(activeCalendarView.value),
)

// On a phone the multi-column modes squeeze day-columns to ~50px and event text becomes
// unreadable. Give the grid a per-mode minimum width so columns stay legible and let the
// body scroll horizontally instead of collapsing. Day and Year keep the full viewport width.
const gridMinWidth = computed(() => {
  if (!isMobileMode.value) return 0
  switch (activeCalendarView.value) {
    case 'week':
    case 'month':
    case '2week':
    case '6week':
      return 700
    case '3day':
      return 460
    default:
      return 0
  }
})

const isGridScroll = computed(() => gridMinWidth.value > 0)

// When the full-screen record sidebar is open on a phone the calendar body collapses to 0
// width; without clipping, its overflowing day-numbers bleed through the sidebar's edges.
const isMobileSidebarOpen = computed(() => isMobileMode.value && showSideMenu.value)

// Viewport-bounded height of the calendar body. Stays the visible height even when the
// grid grows and scrolls, so Month/multi-week can use it as the compact (minimum) row
// height in Expanded mode. Provided to the view components.
const calendarBody = ref<HTMLElement>()

const { height: calendarBodyHeight } = useElementSize(calendarBody)

provide('calendarBodyHeight', calendarBodyHeight)

// The scroll container for the expanded (grid-grows-and-scrolls) views. Provided so Month/Week
// can window their records to the visible band instead of rendering every lane on a dense day.
provide('calendarScrollContainer', calendarBody)

const router = useRouter()

const route = useRoute()

const { withLoading } = useLoadingTrigger()

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(value) {
    if (!value) {
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
    }
  },
})

const expandedFormDlg = ref(false)

const expandedFormRow = ref<RowType>()

const expandedFormRowState = ref<Record<string, any>>()

// Right-click record menu (interface pages only) — an antd contextmenu-trigger
// dropdown wrapping the grid, so antd owns cursor placement + outside-click/Escape close.
const contextMenuTarget = ref<RowType | null>(null)

const _contextMenuOpen = ref(false)

// Also require a record target, so a right-click that misses a record (empty day
// cell) never surfaces a stale menu even though antd flips the open flag.
const contextMenuVisible = computed({
  get: () => _contextMenuOpen.value && !!contextMenuTarget.value,
  set: (val) => {
    _contextMenuOpen.value = val
  },
})

const contextMenuRowId = computed(() =>
  contextMenuTarget.value?.row ? extractPkFromRow(contextMenuTarget.value.row, meta.value?.columns as ColumnType[]) : null,
)

/** Interface pages gate add/delete on the viz opt-in (gallery/kanban parity). */
const canAddDeleteRows = computed(() => isUIAllowed('dataEdit') && isAddDeleteInlineEnabled.value)

/** Duplicate rides the add/delete opt-in like the grid/gallery record menu. */
const canDuplicateRow = computed(() => canAddDeleteRows.value && !isSyncedTable.value)

const expandRecord = (row: RowType, state?: Record<string, any>) => {
  if (interfaceExpandRecord?.(row)) return

  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  expandedFormRowState.value = state

  if (rowId && !isPublic.value) {
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

// A record click coming from the grid while the menu is open should only dismiss
// the menu — not expand the record. (The menu's own "Expand" item calls
// expandRecord directly, so it stays unaffected.)
function onCanvasExpandRecord(row: RowType) {
  if (contextMenuVisible.value) {
    contextMenuVisible.value = false
    return
  }

  expandRecord(row)
}

// A chip's right-click sets the target (target phase); the same DOM event then
// bubbles to the wrapper where antd's contextmenu trigger opens the menu at the
// cursor. Interface-only — elsewhere the trigger is disabled and the browser menu stands.
function onRecordContextMenu(_event: MouseEvent, record: RowType) {
  if (!interfacePageDataApi) return

  contextMenuTarget.value = record
}

// Capture phase (fires before the chip handler) — clears any prior target so a
// right-click landing on empty space resolves to "no target" → no menu.
function onCalendarContextMenu() {
  contextMenuTarget.value = null
}

/** Duplicate the right-clicked record through the interface data adapter. */
async function duplicateRecord() {
  const target = contextMenuTarget.value
  if (!target || !canDuplicateRow.value || !interfacePageDataApi) return

  // Strip identity markers + system columns so the insert creates a brand-new
  // record; it lands on the source record's date. Prompts when the record holds
  // links the copy can't share (null = prompt dismissed).
  const clonedData = await prepareDuplicateRowData(target.row, meta.value?.columns as ColumnType[])
  if (!clonedData) return

  try {
    await interfacePageDataApi.insertRow(clonedData)
    message.toast(t('msg.success.rowDuplicated'))
    reloadViewDataHook?.trigger()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Deep link to this record — the current page URL carrying its rowId. */
async function copyRecordUrl() {
  if (!contextMenuRowId.value) return

  const [origin, hash = ''] = window.location.href.split('#')
  const [hashPath, hashQuery = ''] = hash.split('?')
  const params = new URLSearchParams(hashQuery)
  params.set('rowId', contextMenuRowId.value)

  await copy(`${origin}#${hashPath}?${params.toString()}`)
  message.toast(t('msg.info.copiedToClipboard'))
}

/** Delete the right-clicked record through the interface data adapter. */
async function deleteRecord() {
  const rowId = contextMenuRowId.value
  if (!rowId || !canAddDeleteRows.value || !interfacePageDataApi) return

  try {
    await interfacePageDataApi.deleteRow(rowId)
    reloadViewDataHook?.trigger()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const newRecord = (row: RowType) => {
  if (isPublic.value || (meta.value?.id && !isAllowed(PermissionEntity.TABLE, meta.value?.id, PermissionKey.TABLE_RECORD_ADD))) {
    return
  }

  $e('c:calendar:new-record', activeCalendarView.value)

  const rowFilters = getPlaceholderNewRow(
    [...allFilters.value, ...validFiltersFromUrlParams.value],
    meta.value?.columns as ColumnType[],
    {
      currentUser: user.value ?? undefined,
    },
  )

  // Contextual values (clicked date + filter-implied) — prefill for the form, and
  // the seed for the default expanded form. Generic table defaults are NOT sent to
  // the form so its builder-configured defaults still apply to other fields.
  const contextualRow = {
    ...rowFilters,
    ...row.row,
  }

  // Configured "new record" form takes over the inline add (interface pages).
  if (interfaceNewRecordForm.value?.(contextualRow)) return

  expandRecord({
    row: {
      ...rowDefaultData(meta.value?.columns, user.value ?? undefined),
      ...contextualRow,
    },
    oldRow: {},
    rowMeta: {
      new: true,
    },
  })
}

onMounted(async () => {
  await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
  if (!activeCalendarView.value) {
    activeCalendarView.value = 'month'
  }
})

const reloadViewDataListener = withLoading(async (params: void | { shouldShowLoading?: boolean }) => {
  await Promise.all([
    loadCalendarData(params?.shouldShowLoading ?? false),
    loadSidebarData(params?.shouldShowLoading ?? false),
    fetchActiveDates(),
  ])
})

reloadViewDataHook?.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataHook?.off(reloadViewDataListener)
})

// on filter param changes reload the data
// In calendar view we don't have toolbar search component, so we have to listen to route query changes to reload the data
watch(
  () => route?.query?.where,
  () => {
    reloadViewDataHook?.trigger()
  },
)
</script>

<template>
  <div class="nc-calendar-container flex flex-col h-full">
    <div class="flex h-full relative flex-row" data-testid="nc-calendar-wrapper">
      <div
        ref="calendarBody"
        class="flex flex-col w-full min-h-0 min-w-0"
        :class="{
          'overflow-y-auto nc-scrollbar-md': isHeightExpanded && !isMobileSidebarOpen,
          'nc-scrollbar-x-md': isGridScroll && !isMobileSidebarOpen,
          '!overflow-hidden': isMobileSidebarOpen,
        }"
      >
        <NcDropdown
          v-model:visible="contextMenuVisible"
          :trigger="interfacePageDataApi ? ['contextmenu'] : []"
          overlay-class-name="nc-dropdown-calendar-context-menu"
        >
          <div
            class="flex flex-col h-full w-full"
            :style="isGridScroll ? { minWidth: `${gridMinWidth}px` } : undefined"
            @contextmenu.capture="onCalendarContextMenu"
          >
            <template v-if="calendarRange?.length">
              <LazySmartsheetCalendarYearView v-if="activeCalendarView === 'year'" />
              <template v-if="!isCalendarDataLoading">
                <LazySmartsheetCalendarMonthView
                  v-if="activeCalendarView === 'month' || isMultiWeekRange"
                  @expand-record="onCanvasExpandRecord"
                  @new-record="newRecord"
                  @record-context-menu="onRecordContextMenu"
                />

                <LazySmartsheetCalendarWeekViewDateField
                  v-else-if="(activeCalendarView === 'week' || isDayAnchoredMode) && calDataType === UITypes.Date"
                  @expand-record="onCanvasExpandRecord"
                  @new-record="newRecord"
                  @record-context-menu="onRecordContextMenu"
                />
                <LazySmartsheetCalendarWeekViewDateTimeField
                  v-else-if="
                    (activeCalendarView === 'week' || isDayAnchoredMode) &&
                    [UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.Formula].includes(calDataType)
                  "
                  @expand-record="onCanvasExpandRecord"
                  @new-record="newRecord"
                  @record-context-menu="onRecordContextMenu"
                />
                <LazySmartsheetCalendarDayViewDateField
                  v-else-if="activeCalendarView === 'day' && calDataType === UITypes.Date"
                  @expand-record="onCanvasExpandRecord"
                  @new-record="newRecord"
                  @record-context-menu="onRecordContextMenu"
                />
                <LazySmartsheetCalendarDayViewDateTimeField
                  v-else-if="
                    activeCalendarView === 'day' &&
                    [UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.Formula].includes(calDataType)
                  "
                  @expand-record="onCanvasExpandRecord"
                  @new-record="newRecord"
                  @record-context-menu="onRecordContextMenu"
                />
              </template>

              <div
                v-if="isCalendarDataLoading && activeCalendarView !== 'year'"
                class="flex w-full items-center h-full justify-center"
              >
                <GeneralLoader size="xlarge" />
              </div>
            </template>
            <template v-else>
              <div class="flex w-full items-center h-full justify-center">
                {{ $t('activity.noRange') }}
              </div>
            </template>
          </div>
          <template #overlay>
            <NcMenu class="!rounded-lg nc-interface-card-context-menu" variant="default" @click="contextMenuVisible = false">
              <NcMenuItem v-if="canDuplicateRow" data-testid="nc-interface-calendar-menu-duplicate" @click="duplicateRecord">
                <div v-e="['c:interface:calendar:record:duplicate']" class="flex items-center gap-2">
                  <GeneralIcon icon="duplicate" class="flex" />
                  {{ $t('labels.duplicateRecord') }}
                </div>
              </NcMenuItem>
              <NcMenuItem v-if="contextMenuTarget && interfaceClickIntoDetails" @click="expandRecord(contextMenuTarget)">
                <div v-e="['a:row:expand-record']" class="flex items-center gap-2">
                  <component :is="iconMap.maximize" class="flex" />
                  {{ $t('activity.expandRecord') }}
                </div>
              </NcMenuItem>
              <template v-if="contextMenuRowId">
                <NcDivider v-if="canDuplicateRow || (contextMenuTarget && interfaceClickIntoDetails)" />
                <NcMenuItem data-testid="nc-interface-calendar-menu-copy-url" @click="copyRecordUrl">
                  <div v-e="['c:interface:calendar:record:copy-url']" class="flex items-center gap-2">
                    <GeneralIcon icon="ncLink" class="flex" />
                    {{ $t('labels.copyRecordURL') }}
                  </div>
                </NcMenuItem>
              </template>
              <template v-if="canAddDeleteRows">
                <NcDivider />
                <PermissionsTooltip
                  :entity="PermissionEntity.TABLE"
                  :entity-id="meta?.id"
                  :permission="PermissionKey.TABLE_RECORD_DELETE"
                  placement="right"
                >
                  <template #default="{ isAllowed: isDeleteAllowed }">
                    <NcMenuItem danger :disabled="!isDeleteAllowed" @click="deleteRecord">
                      <div v-e="['a:row:delete']" class="flex items-center gap-2">
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
      </div>
      <Transition>
        <LazySmartsheetCalendarSideMenu
          v-show="showSideMenu"
          :visible="showSideMenu"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
      </Transition>
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="expandedFormRow"
        :load-row="!isPublic"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
      />
    </Suspense>

    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      close-after-save
      :load-row="!isPublic"
      :meta="meta"
      :state="expandedFormRowState"
      :row="{
        row: {},
        oldRow: {},
        rowMeta: {},
      }"
      :row-id="route.query.rowId"
      :expand-form="expandRecord"
      :view="view"
    />
  </div>
</template>

<style scoped lang="scss">
.v-enter-from,
.v-leave-to {
  transform: translateX(200%);
}

.v-enter-to,
.v-leave-from {
  transform: translateX(100%);
}
</style>
