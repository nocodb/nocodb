<script setup lang="ts">
import { IsPublicInj, inject, ref, useRoles, useSharedView, useSmartsheetStoreOrThrow, useViewsStore } from '#imports'

const { isGrid, isGallery, isKanban, isMap } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    class="nc-table-toolbar py-1 px-2.25 xs:(px-1) flex gap-2 items-center border-b border-gray-200 overflow-hidden xs:(min-h-14) max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] z-7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <LazySmartsheetToolbarMappedBy v-if="isMap" />

      <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap" :show-system-fields="false" />

      <LazySmartsheetToolbarStackedBy v-if="isKanban" />

      <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

      <LazySmartsheetToolbarGroupByMenu v-if="isGrid" />

      <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

      <template v-if="!isMobileMode">
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
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
