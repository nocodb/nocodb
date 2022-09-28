<script setup lang="ts">
import { IsPublicInj, inject, ref, useSharedView, useSidebar, useSmartsheetStoreOrThrow, useUIPermission } from '#imports'

const { isGrid, isForm, isGallery, isSqlView } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useUIPermission()

const { isOpen } = useSidebar('nc-right-sidebar')

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    class="nc-table-toolbar w-full py-1 flex gap-1 items-center h-[var(--toolbar-height)] px-2 border-b overflow-x-hidden"
    style="z-index: 7"
  >
    <LazySmartsheetToolbarViewActions
      v-if="(isGrid || isGallery) && !isPublic && isUIAllowed('dataInsert')"
      :show-system-fields="false"
      class="ml-1"
    />

    <LazySmartsheetToolbarViewInfo v-if="!isUIAllowed('dataInsert') && !isPublic" />

    <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery" :show-system-fields="false" class="ml-1" />

    <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery" />

    <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery" />

    <LazySmartsheetToolbarShareView v-if="(isForm || isGrid) && !isPublic" />

    <LazySmartsheetToolbarExport v-if="(!isPublic && !isUIAllowed('dataInsert')) || (isPublic && allowCSVDownload)" />

    <div class="flex-1" />

    <LazySmartsheetToolbarReload v-if="!isPublic && !isForm" class="mx-1" />

    <LazySmartsheetToolbarAddRow v-if="isUIAllowed('dataInsert') && !isPublic && !isForm && !isSqlView" class="mx-1" />

    <LazySmartsheetToolbarSearchData v-if="(isGrid || isGallery) && !isPublic" class="shrink mr-2 ml-2" />

    <template v-if="!isOpen && !isPublic">
      <div class="border-l-1 pl-3">
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
