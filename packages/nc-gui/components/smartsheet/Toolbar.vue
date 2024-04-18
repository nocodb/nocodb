<script lang="ts" setup>
import {
  IsPublicInj,
  inject,
  ref,
  storeToRefs,
  useGlobal,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useViewsStore,
} from '#imports'

const { isGrid, isGallery, isKanban, isMap, isCalendar } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const { toggleExtensionPanel, isPanelExpanded } = useExtensions()

const containerRef = ref<HTMLElement>()

const isTab = ref(true)

const handleResize = () => {
  isTab.value = containerRef.value.offsetWidth > 810
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
    class="nc-table-toolbar relative py-1 pl-2.25 xs:(px-1) flex gap-2 items-center border-b border-gray-200 overflow-hidden xs:(min-h-14) max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] z-7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <LazySmartsheetToolbarMappedBy v-if="isMap" />
      <LazySmartsheetToolbarCalendarRange v-if="isCalendar" />

      <LazySmartsheetToolbarFieldsMenu
        v-if="isGrid || isGallery || isKanban || isMap || isCalendar"
        :show-system-fields="false"
      />

      <LazySmartsheetToolbarStackedBy v-if="isKanban" />

      <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap || isCalendar" />

      <LazySmartsheetToolbarGroupByMenu v-if="isGrid" />

      <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban || isCalendar" />

      <div v-if="isCalendar && isTab" class="flex-1" />
      <LazySmartsheetToolbarCalendarMode v-if="isCalendar" v-model:tab="isTab" />

      <template v-if="!isMobileMode">
        <LazySmartsheetToolbarRowHeight v-if="isGrid" />

        <!-- <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" /> -->

        <LazySmartsheetToolbarExport v-if="isPublic && allowCSVDownload" />

        <div class="flex-1" />
      </template>

      <LazySmartsheetToolbarSearchData
        v-if="isGrid || isGallery || isKanban"
        :class="{
          'shrink': !isMobileMode,
          'w-full': isMobileMode,
        }"
      />

      <div
        class="flex items-center px-2 py-1 gap-2 border-l-1 border-t-1 border-b-1 rounded-l-lg h-8 xs:(h-10 ml-0) ml-1 border-gray-200 cursor-pointer font-weight-600"
        :class="{ 'bg-orange-50': isPanelExpanded }"
        @click="toggleExtensionPanel"
      >
        <GeneralIcon icon="puzzle" :class="{ 'text-orange-500': isPanelExpanded, 'border-l-1 border-white': isPanelExpanded }" />
        <template v-if="!isPanelExpanded">Extensions</template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
