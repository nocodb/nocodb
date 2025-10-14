<script lang="ts" setup>
defineProps<{
  showFullScreenToggle?: boolean
}>()

const isPublic = inject(IsPublicInj, ref(false))

const { isGrid, isGallery, isKanban, isMap, isCalendar, isViewOperationsAllowed } = useSmartsheetStoreOrThrow()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isViewActionsEnabled } = useActionPane()

const { isLocalMode } = useViewColumnsOrThrow()

const containerRef = ref<HTMLElement>()

const { width } = useElementSize(containerRef)

const router = useRouter()

const disableToolbar = computed(
  () => router.currentRoute.value.query?.disableToolbar === 'true' || (isCalendar.value && isMobileMode.value),
)

const isTab = computed(() => {
  if (!isCalendar.value) return false
  return width.value > 1200
})

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
    v-if="!disableToolbar"
    ref="containerRef"
    :class="{
      'px-4': isMobileMode,
    }"
    class="nc-table-toolbar bg-nc-bg-default relative px-3 flex gap-2 items-center border-b border-nc-border-gray-medium overflow-hidden xs:(min-h-14) min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)] z-7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <div
        v-if="!isMobileMode"
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
          <LazySmartsheetToolbarCalendarToday />
          <LazySmartsheetToolbarCalendarNextPrev />
        </template>

        <template v-if="isViewOperationsAllowed">
          <SmartsheetToolbarMappedBy v-if="isMap" />

          <SmartsheetToolbarStackedBy v-if="isKanban" />

          <SmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap" :show-system-fields="false" />

          <SmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

          <SmartsheetToolbarGroupByMenu v-if="isGrid && !isLocalMode" />

          <SmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

          <SmartsheetToolbarRowColorFilterDropdown v-if="!isPublic && !isSharedBase && (isGrid || isGallery || isKanban)" />

          <SmartsheetToolbarBulkAction
            v-if="(isGrid || isGallery) && !isPublic && !isSharedBase && isUIAllowed('scriptExecute') && isViewActionsEnabled"
          />
        </template>

        <template v-if="isCalendar">
          <SmartsheetToolbarExport v-if="!isViewOperationsAllowed" is-in-toolbar />
          <SmartsheetToolbarOpenedViewAction :show-only-copy-id="!isViewOperationsAllowed" />
        </template>
      </div>

      <SmartsheetToolbarCalendarMode v-if="isCalendar && isTab" :tab="isTab" />

      <template v-if="!isMobileMode">
        <SmartsheetToolbarRowHeight v-if="isGrid && isViewOperationsAllowed" />

        <template v-if="!isCalendar">
          <SmartsheetToolbarExport v-if="!isViewOperationsAllowed" is-in-toolbar />
          <SmartsheetToolbarOpenedViewAction :show-only-copy-id="!isViewOperationsAllowed" />
        </template>

        <!-- <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" /> -->

        <div class="flex-1" />
      </template>

      <SmartsheetToolbarCalendarActiveView v-if="isCalendar" />

      <SmartsheetToolbarSearchData
        v-if="isGrid || isGallery || isKanban"
        :class="{
          'shrink': !isMobileMode,
          'w-full': isMobileMode,
        }"
      />

      <div v-if="isCalendar && isMobileMode" class="flex-1 pointer-events-none" />

      <SmartsheetToolbarCalendarMode v-if="isCalendar && !isTab" :tab="isTab" />

      <SmartsheetToolbarCalendarRange v-if="isCalendar && isViewOperationsAllowed" />

      <template v-if="isCalendar && !isMobileMode">
        <SmartsheetToolbarRowColorFilterDropdown v-if="!isPublic && !isSharedBase && isViewOperationsAllowed" />
        <SmartsheetToolbarFieldsMenu :show-system-fields="false" />
        <SmartsheetToolbarColumnFilterMenu v-if="isViewOperationsAllowed" />

        <SmartsheetToolbarCalendarToggleSideBar />
      </template>
      <NcFullScreenToggleButton v-if="showFullScreenToggle" />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
