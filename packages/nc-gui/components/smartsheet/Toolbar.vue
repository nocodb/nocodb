<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import { IsPublicInj, inject, ref, useSharedView, useSidebar, useSmartsheetStoreOrThrow, useUIPermission } from '#imports'

const { isGrid, isForm, isGallery, isKanban, isMap, isSqlView } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isOpen: isSidebarOpen } = storeToRefs(useSidebarStore())

const { isMobileMode } = useGlobal()

const { activeTable } = storeToRefs(useTablesStore())

const { isUIAllowed } = useUIPermission()

const { isOpen } = useSidebar('nc-right-sidebar')

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    class="nc-table-toolbar w-full py-1 flex gap-2 items-center pl-3 pr-2 border-b border-gray-100 overflow-x-hidden"
    :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode, 'pl-8': !isSidebarOpen }"
    style="z-index: 7"
  >
    <LazySmartsheetToolbarViewInfo />

    <div v-if="!isMobileMode" class="flex-1" />

    <LazySmartsheetToolbarShareView v-if="(isForm || isGrid || isKanban || isGallery || isMap) && !isPublic" />

    <LazySmartsheetToolbarViewInfo v-if="!isUIAllowed('dataInsert') && !isPublic" />

    <LazySmartsheetToolbarStackedBy v-if="isKanban" />

    <LazySmartsheetToolbarKanbanStackEditOrAdd v-if="isKanban" />

    <LazySmartsheetToolbarMappedBy v-if="isMap" />

    <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap" :show-system-fields="false" />

    <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

    <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

    <LazySmartsheetToolbarRowHeight v-if="isGrid" />

    <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" />

    <LazySmartsheetToolbarExport v-if="(!isPublic && !isUIAllowed('dataInsert')) || (isPublic && allowCSVDownload)" />

    <LazySmartsheetToolbarSearchData v-if="(isGrid || isGallery || isKanban) && !isPublic" class="shrink" />

    <LazyGeneralShareBaseButton class="" />
    <LazyGeneralShareProject class="" />

    <LazySmartsheetToolbarViewActions
      v-if="(isGrid || isGallery || isKanban || isMap) && !isPublic && isUIAllowed('dataInsert')"
      :show-system-fields="false"
    />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}

.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
