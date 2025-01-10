<script lang="ts" setup>
const { isGrid, isGallery, isKanban, isMap, isCalendar } = useSmartsheetStoreOrThrow()

const { isMobileMode } = useGlobal()
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isLocalMode } = useViewColumnsOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isSharedBase } = useBase()

const containerRef = ref<HTMLElement>()

const { width } = useElementSize(containerRef)

const router = useRouter()

const disableToolbar = computed(() => router.currentRoute.value.query?.disableToolbar === 'true')

const isTab = computed(() => {
  if (!isCalendar.value) return false
  return width.value > 1200
})

const { isUIAllowed } = useRoles()

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

const isToolbarIconMode = computed(() => {
  if (width.value < 768) {
    return true
  }
  return false
})

provide(IsToolbarIconMode, isToolbarIconMode)
</script>

<template>
  <div
    v-if="!isMobileMode && !disableToolbar"
    ref="containerRef"
    :class="{
      'px-4': isMobileMode,
    }"
    class="nc-table-toolbar relative px-3 flex gap-2 items-center border-b border-gray-200 overflow-hidden xs:(min-h-14) min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)] z-7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <div
        :class="{
          'min-w-34/100': !isMobileMode && isLeftSidebarOpen && isCalendar,
          'min-w-39/100': !isMobileMode && !isLeftSidebarOpen && isCalendar,
          'gap-1': isCalendar,
        }"
        class="flex items-center gap-3"
      >
        <LazySmartsheetToolbarMappedBy v-if="isMap" />
        <LazySmartsheetToolbarCalendarHeader v-if="isCalendar" />
        <LazySmartsheetToolbarCalendarToday v-if="isCalendar" />

        <LazySmartsheetToolbarCalendarRange v-if="isCalendar" />

        <LazySmartsheetToolbarStackedBy v-if="isKanban" />

        <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap" :show-system-fields="false" />

        <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

        <LazySmartsheetToolbarGroupByMenu v-if="isGrid && !isLocalMode" />

        <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />
        <LazySmartsheetToolbarBulkAction
          v-if="(isGrid || isGallery) && !isPublic && isAutomationEnabled && !isSharedBase && isUIAllowed('scriptExecute')"
        />

        <LazySmartsheetToolbarOpenedViewAction v-if="isCalendar" />
      </div>

      <LazySmartsheetToolbarCalendarMode v-if="isCalendar && isTab" :tab="isTab" />

      <template v-if="!isMobileMode">
        <LazySmartsheetToolbarRowHeight v-if="isGrid" />

        <LazySmartsheetToolbarOpenedViewAction v-if="!isCalendar" />
        <!-- <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" /> -->

        <div class="flex-1" />
      </template>

      <LazySmartsheetToolbarCalendarActiveView v-if="isCalendar" />

      <LazySmartsheetToolbarSearchData
        v-if="isGrid || isGallery || isKanban"
        :class="{
          'shrink': !isMobileMode,
          'w-full': isMobileMode,
        }"
      />
      <div v-if="isCalendar && isMobileMode" class="flex-1 pointer-events-none" />

      <LazySmartsheetToolbarCalendarMode v-if="isCalendar && !isTab" :tab="isTab" />

      <LazySmartsheetToolbarFieldsMenu v-if="isCalendar && !isMobileMode" :show-system-fields="false" />
      <LazySmartsheetToolbarColumnFilterMenu v-if="isCalendar && !isMobileMode" />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
