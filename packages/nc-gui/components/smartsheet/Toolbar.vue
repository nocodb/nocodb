<script setup lang="ts">
import { IsPublicInj, inject, ref, useRoles, useSharedView, useSmartsheetStoreOrThrow, useViewsStore } from '#imports'

const { isGrid, isGallery, isKanban, isMap } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { allowCSVDownload } = useSharedView()

const isViewSidebarAvailable = computed(
  () => (isGrid.value || isGallery.value || isKanban.value || isMap.value) && !isPublic.value,
)
</script>

<template>
  <div
    class="nc-table-toolbar h-12 min-h-12 py-1 flex gap-2 items-center border-b border-gray-200 overflow-hidden"
    :class="{
      'h-8': isMobileMode,
      'max-h-[var(--topbar-height)] min-h-[var(--topbar-height)]': !isMobileMode,
      'pl-3 pr-0': isViewSidebarAvailable && !isMobileMode,
      'px-3': !isViewSidebarAvailable && !isMobileMode,
      'px-1': isMobileMode,
    }"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <template v-if="!isMobileMode">
        <LazySmartsheetToolbarMappedBy v-if="isMap" />

        <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap" :show-system-fields="false" />

        <LazySmartsheetToolbarStackedBy v-if="isKanban" />

        <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

        <LazySmartsheetToolbarGroupByMenu v-if="isGrid" />

        <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

        <LazySmartsheetToolbarRowHeight v-if="isGrid" />

        <!-- <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" /> -->

        <LazySmartsheetToolbarExport v-if="(!isPublic && !isUIAllowed('dataInsert')) || (isPublic && allowCSVDownload)" />

        <div class="flex-1" />
      </template>

      <LazySmartsheetToolbarSearchData
        v-if="(isGrid || isGallery || isKanban) && !isPublic"
        :class="{
          'shrink': !isMobileMode,
          'w-full': isMobileMode,
        }"
      />

      <template v-if="!isMobileMode">
        <LazySmartsheetToolbarViewActions
          v-if="(isGrid || isGallery || isKanban || isMap) && !isPublic && isUIAllowed('dataInsert')"
          :show-system-fields="false"
        />
      </template>
      <LazySmartsheetToolbarOpenViewSidebarBtn v-if="isViewSidebarAvailable" />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
