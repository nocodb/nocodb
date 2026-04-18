<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

defineProps<{
  showFullScreenToggle?: boolean
}>()

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const { isGrid, isGallery, isKanban, isMap, isCalendar, isList, isForm, isViewOperationsAllowed, allFilters, isTimeline, meta } =
  useSmartsheetStoreOrThrow()

const hasDeletedField = computed(() => {
  return !!(meta.value as TableType)?.columns?.some((c) => c.uidt === UITypes.Deleted)
})

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
  () =>
    router.currentRoute.value.query?.disableToolbar === 'true' ||
    (isCalendar.value && isMobileMode.value) ||
    isTimeline.value ||
    isForm.value,
)

const isTab = computed(() => {
  if (!isCalendar.value) return false
  return width.value > 1200
})

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
        <template v-if="isCalendar && !isMobileMode">
          <LazySmartsheetToolbarCalendarHeader />
          <LazySmartsheetToolbarCalendarToday />
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

      <SmartsheetToolbarCalendarMode v-if="isCalendar && isTab" :tab="isTab" />

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

      <LazySmartsheetToolbarRecordTrash
        v-if="isEeUI && !isPublic && !isSharedBase && !isMobileMode && !isForm && hasDeletedField && isUIAllowed('dataEdit')"
      />

      <div v-if="isCalendar && isMobileMode" class="flex-1 pointer-events-none" />

      <SmartsheetToolbarCalendarMode v-if="isCalendar && !isTab" :tab="isTab" />

      <SmartsheetToolbarCalendarRange v-if="isCalendar && isViewOperationsAllowed" />

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
      <NcFullScreenToggleButton v-if="showFullScreenToggle && !isMobileMode" />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
