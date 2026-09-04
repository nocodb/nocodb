<script lang="ts" setup>
defineProps<{
  showFullScreenToggle?: boolean
}>()

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const { isGrid, isGallery, isKanban, isMap, isCalendar, isList, isForm, isViewOperationsAllowed, allFilters, isTimeline } =
  useSmartsheetStoreOrThrow()

const { numberOfHiddenFields } = useViewColumnsOrThrow()

const { isUIAllowed } = useRoles()

const { hasPersonalViewPermission } = usePersonalViewPermissions(activeView)

const canSyncFilter = hasPersonalViewPermission('filterSync')

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isViewActionsEnabled } = useActionPane()

const { blockPinnedFilter, showEEFeatures, isEEFeatureBlocked } = useEeConfig()

const containerRef = ref<HTMLElement>()

const { width } = useElementSize(containerRef)

const router = useRouter()

const disableToolbar = computed(
  () => router.currentRoute.value.query?.disableToolbar === 'true' || isTimeline.value || isForm.value,
)

/** EE only: Check if any filters are pinned to the toolbar.
 *  Hidden for restricted editors in collaborative/locked views — they cannot modify filters.
 *  Visible for personal view owners — they have full control over view config. */
const hasPinnedFilters = computed(() => {
  if (!isEeUI) return false
  if (blockPinnedFilter.value) return false
  if (isLocked.value || !canSyncFilter.value) return false
  return allFilters.value.some((f) => f.id && !f.is_group && parseProp(f.meta)?.pinned === true)
})

const isToolbarIconMode = computed(() => {
  if (width.value < 768) {
    return true
  }
  if (hasPinnedFilters.value) {
    return true
  }
  return false
})

provide(IsToolbarIconMode, isToolbarIconMode)

const isSearchExpanded = ref(false)

const isMobileSearchActive = computed(() => isMobileMode.value && isSearchExpanded.value)

// Active-filter count for the mobile "more" menu — derived from the shared `allFilters` store ref
// (same source the pinned-filter check uses); counts persisted, non-group filter conditions.
const calendarFilterCount = computed(() => allFilters.value.filter((f) => f.id && !f.is_group).length)

// Mobile: the calendar config controls are kept mounted but sr-only; open one by clicking its
// (drawer) trigger button. Deferred a tick so the "more" menu closes first.
function triggerToolbarControl(selector: string) {
  const btn = containerRef.value?.querySelector<HTMLElement>(selector)
  if (btn) {
    setTimeout(() => btn.click(), 50)
  }
}
</script>

<template>
  <div
    v-if="!disableToolbar"
    ref="containerRef"
    :class="{
      'px-4': isMobileMode,
    }"
    class="nc-table-toolbar bg-nc-bg-default relative px-3 flex gap-2 items-center border-b border-nc-border-gray-medium overflow-hidden min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)] z-7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <div
        v-if="!isMobileSearchActive"
        :class="{
          'min-w-34/100': !isMobileMode && isLeftSidebarOpen && isCalendar,
          'min-w-39/100': !isMobileMode && !isLeftSidebarOpen && isCalendar,
          '!gap-1': isCalendar && isViewOperationsAllowed,
          '!gap-2': isCalendar && !isViewOperationsAllowed,
        }"
        class="flex items-center gap-3 empty:hidden"
      >
        <template v-if="isCalendar">
          <LazySmartsheetToolbarCalendarHeader />
          <LazySmartsheetToolbarCalendarToday v-if="!isMobileMode" />
          <LazySmartsheetToolbarCalendarNextPrev />
        </template>

        <template v-if="isViewOperationsAllowed">
          <SmartsheetToolbarMappedBy v-if="isMap" />

          <SmartsheetToolbarStackedBy v-if="isKanban" />

          <SmartsheetToolbarListSetLevels v-if="isList" />

          <SmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap || isList" :show-system-fields="false" />

          <SmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap || isList" />

          <SmartsheetToolbarGroupByMenu v-if="isGrid" />

          <SmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban || isList" />

          <SmartsheetToolbarRowColorFilterDropdown
            v-if="!isMobileMode && !isPublic && !isSharedBase && showEEFeatures && (isGrid || isGallery || isKanban || isList)"
          />

          <SmartsheetToolbarBulkAction
            v-if="
              !isMobileMode &&
              (isGrid || isGallery) &&
              !isPublic &&
              !isSharedBase &&
              isUIAllowed('scriptExecute') &&
              isViewActionsEnabled &&
              showEEFeatures &&
              !isEEFeatureBlocked
            "
          />
        </template>

        <template v-if="isCalendar && !isMobileMode">
          <SmartsheetToolbarExport v-if="!isViewOperationsAllowed" is-in-toolbar />
          <SmartsheetToolbarOpenedViewAction :show-only-copy-id="!isViewOperationsAllowed" />
        </template>
      </div>

      <SmartsheetToolbarRowHeight v-if="(isGrid || isList) && isViewOperationsAllowed && !isMobileMode" />

      <template v-if="!isCalendar">
        <SmartsheetToolbarExport v-if="!isViewOperationsAllowed" is-in-toolbar />
        <SmartsheetToolbarOpenedViewAction v-if="!isMobileSearchActive" :show-only-copy-id="!isViewOperationsAllowed" />
      </template>

      <SmartsheetToolbarPinnedFilters
        v-if="
          isEeUI &&
          !blockPinnedFilter &&
          !isMobileMode &&
          !isLocked &&
          canSyncFilter &&
          (isGrid || isGallery || isKanban || isMap)
        "
      />

      <div v-if="!isMobileSearchActive" class="flex-1" />

      <SmartsheetToolbarCalendarActiveView v-if="isCalendar" />

      <SmartsheetToolbarSearchData
        v-if="isGrid || isGallery || isKanban || isList"
        v-model:search-expanded="isSearchExpanded"
        :class="isMobileSearchActive ? 'flex-1 min-w-0' : 'shrink'"
      />

      <div v-if="isCalendar && isMobileMode" class="flex-1 pointer-events-none" />

      <SmartsheetToolbarCalendarMode v-if="isCalendar" :tab="false" />

      <SmartsheetToolbarCalendarRecordHeight v-if="isCalendar && !isMobileMode" />

      <SmartsheetToolbarCalendarEventTheme
        v-if="isCalendar && !isMobileMode && !isPublic && !isSharedBase && isViewOperationsAllowed && showEEFeatures"
      />

      <SmartsheetToolbarCalendarRange v-if="isCalendar && isViewOperationsAllowed && !isMobileMode" />

      <!-- Mobile: the calendar config controls stay mounted but visually hidden; the "more" menu
           opens each one by triggering its (drawer) button. Row color is intentionally left off. -->
      <div v-if="isCalendar && isMobileMode" class="sr-only">
        <SmartsheetToolbarColumnFilterMenu v-if="isViewOperationsAllowed" />
        <SmartsheetToolbarFieldsMenu :show-system-fields="false" />
        <SmartsheetToolbarCalendarRecordHeight />
        <SmartsheetToolbarCalendarEventTheme v-if="!isPublic && !isSharedBase && isViewOperationsAllowed && showEEFeatures" />
        <SmartsheetToolbarCalendarRange v-if="isViewOperationsAllowed" />
      </div>

      <NcDropdown v-if="isCalendar && isMobileMode" :trigger="['click']" overlay-class-name="nc-dropdown-calendar-mobile-more">
        <NcButton
          class="nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
          size="small"
          type="secondary"
          data-testid="nc-calendar-mobile-more-btn"
        >
          <GeneralIcon icon="threeDotVertical" class="!h-4 !w-4" />
        </NcButton>
        <template #overlay>
          <NcMenu class="!min-w-44" variant="small">
            <NcMenuItem
              v-if="isViewOperationsAllowed"
              data-testid="nc-calendar-more-filter"
              inner-class="w-full"
              @click="triggerToolbarControl('.nc-filter-menu-btn')"
            >
              <div class="flex items-center gap-2 w-full">
                <GeneralIcon icon="filter" class="!h-4 !w-4 text-nc-content-gray-subtle" />
                {{ $t('activity.filter') }}
                <span v-if="calendarFilterCount" class="ml-auto nc-toolbar-btn-chip bg-nc-bg-brand text-nc-content-brand">
                  {{ calendarFilterCount }}
                </span>
              </div>
            </NcMenuItem>
            <NcMenuItem
              data-testid="nc-calendar-more-fields"
              inner-class="w-full"
              @click="triggerToolbarControl('.nc-fields-menu-btn')"
            >
              <div class="flex items-center gap-2 w-full">
                <GeneralIcon icon="fields" class="!h-4 !w-4 text-nc-content-gray-subtle" />
                {{ $t('objects.fields') }}
                <span v-if="numberOfHiddenFields" class="ml-auto nc-toolbar-btn-chip bg-nc-bg-brand text-nc-content-brand">
                  {{ numberOfHiddenFields }}
                </span>
              </div>
            </NcMenuItem>
            <NcMenuItem
              data-testid="nc-calendar-more-record-height"
              @click="triggerToolbarControl('[data-testid=nc-calendar-record-height]')"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="rowHeight" class="!h-4 !w-4 text-nc-content-gray-subtle" />
                {{ $t('objects.rowHeight') }}
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-if="!isPublic && !isSharedBase && isViewOperationsAllowed && showEEFeatures"
              data-testid="nc-calendar-more-event-theme"
              inner-class="w-full"
              @click="triggerToolbarControl('[data-testid=nc-calendar-event-theme]')"
            >
              <div class="flex items-center gap-2 w-full">
                <GeneralIcon icon="palette" class="!h-4 !w-4 text-nc-content-gray-subtle" />
                {{ $t('activity.eventTheme') }}
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-if="isViewOperationsAllowed"
              data-testid="nc-calendar-more-settings"
              @click="triggerToolbarControl('[data-testid=nc-calendar-range-btn]')"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="settings" class="!h-4 !w-4 text-nc-content-gray-subtle" />
                {{ $t('activity.settings') }}
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>

      <SmartsheetToolbarCalendarToggleSideBar v-if="isCalendar && isMobileMode" />

      <template v-if="isCalendar && !isMobileMode">
        <SmartsheetToolbarRowColorFilterDropdown v-if="!isPublic && !isSharedBase && isViewOperationsAllowed && showEEFeatures" />
        <SmartsheetToolbarFieldsMenu :show-system-fields="false" />
        <SmartsheetToolbarColumnFilterMenu v-if="isViewOperationsAllowed" />

        <SmartsheetToolbarCalendarToggleSideBar />
      </template>

      <!-- Kept mounted but visually hidden — the component registers record template
           state/listeners that the AddNewRowMenu depends on. Will be fully removed
           once record templates are decoupled from the toolbar lifecycle. -->
      <SmartsheetToolbarRecordTemplatesButton
        v-if="isEeUI && isGrid && isUIAllowed('viewOperations') && !isPublic && !isSharedBase && !isMobileMode"
        class="hidden sr-only"
      />
      <ShareIndexTrigger
        v-if="!isMobileSearchActive && (isGrid || isGallery || isKanban || isMap || isList || isCalendar || isForm)"
      />
      <NcFullScreenToggleButton v-if="showFullScreenToggle && !isMobileMode" />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
