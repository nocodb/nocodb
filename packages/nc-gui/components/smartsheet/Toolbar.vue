<script setup lang="ts">
import { IsPublicInj, inject, ref, useSharedView, useSidebar, useSmartsheetStoreOrThrow, useUIPermission } from '#imports'

const { isGrid, isForm, isGallery, isKanban, isSqlView } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useUIPermission()

const { isOpen } = useSidebar('nc-right-sidebar')

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    class="nc-table-toolbar w-full py-1 flex gap-2 items-center px-2 border-b overflow-x-hidden"
    :class="{ 'nc-table-toolbar--mobile flex-wrap h-auto': isMobileMode, 'h-[var(--toolbar-height)]': !isMobileMode }"
    style="z-index: 7"
  >
    <LazySmartsheetToolbarViewActions
      v-if="(isGrid || isGallery || isKanban) && !isPublic && isUIAllowed('dataInsert')"
      :show-system-fields="false"
      class="ml-1"
    />

    <LazySmartsheetToolbarViewInfo v-if="!isUIAllowed('dataInsert') && !isPublic" />

    <LazySmartsheetToolbarStackedBy v-if="isKanban" />

    <LazySmartsheetToolbarKanbanStackEditOrAdd v-if="isKanban" />

    <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban" :show-system-fields="false" />

    <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban" />

    <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

    <LazySmartsheetToolbarRowHeight v-if="isGrid" />

    <LazySmartsheetToolbarShareView v-if="(isForm || isGrid || isKanban || isGallery) && !isPublic" />

    <LazySmartsheetToolbarQrScannerButton v-if="isGrid || isKanban || isGallery" />

    <LazySmartsheetToolbarExport v-if="(!isPublic && !isUIAllowed('dataInsert')) || (isPublic && allowCSVDownload)" />
    <div v-if="!isMobileMode" class="flex-1" />

    <LazySmartsheetToolbarReload v-if="!isPublic && !isForm" />

    <LazySmartsheetToolbarAddRow v-if="isUIAllowed('dataInsert') && !isPublic && !isForm && !isSqlView" />

    <LazySmartsheetToolbarSearchData v-if="(isGrid || isGallery || isKanban) && !isPublic" class="shrink mx-2" />

    <template v-if="!isOpen && !isPublic">
      <div class="border-l-1 pl-3 nc-views-show-sidebar-button" :class="{ 'ml-auto': isMobileMode }">
        <LazySmartsheetSidebarToolbarToggleDrawer class="mr-2" />
      </div>
    </template>
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}

.nc-table-toolbar {
  border-color: #f0f0f0 !important;
}
</style>
