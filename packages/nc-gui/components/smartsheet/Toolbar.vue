<script lang="ts" setup>
const { isGrid, isGallery, isKanban, isMap, isCalendar } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const containerRef = ref<HTMLElement>()

const isTab = ref(true)

const handleResize = () => {
  isTab.value = !!containerRef.value && containerRef.value.offsetWidth > 970
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    v-if="!isMobileMode || !isCalendar"
    ref="containerRef"
    class="nc-table-toolbar relative py-1 px-2.25 xs:(px-1) flex gap-2 items-center border-b border-gray-200 overflow-hidden xs:(min-h-14) max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] z-7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <LazySmartsheetToolbarMappedBy v-if="isMap" />
      <LazySmartsheetToolbarCalendarHeader v-if="isCalendar" />
      <LazySmartsheetToolbarCalendarRange v-if="isCalendar" />

      <LazySmartsheetToolbarFieldsMenu
        v-if="isGrid || isGallery || isKanban || isMap || isCalendar"
        :show-system-fields="false"
      />

      <LazySmartsheetToolbarStackedBy v-if="isKanban" />

      <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

      <LazySmartsheetToolbarGroupByMenu v-if="isGrid" />

      <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

      <LazySmartsheetToolbarCalendarMode v-if="isCalendar" v-model:tab="isTab" />

      <template v-if="!isMobileMode">
        <LazySmartsheetToolbarRowHeight v-if="isGrid" />

        <!-- <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" /> -->

        <LazySmartsheetToolbarExport v-if="isPublic && allowCSVDownload" />

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
      <LazySmartsheetToolbarCalendarToday v-if="isCalendar" />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
