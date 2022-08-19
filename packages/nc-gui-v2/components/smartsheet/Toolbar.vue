<script setup lang="ts">
import { IsPublicInj, useSmartsheetStoreOrThrow } from '#imports'

const { isGrid, isForm, isGallery } = useSmartsheetStoreOrThrow()
const { allowCSVDownload } = useSharedView()
const isPublic = inject(IsPublicInj, ref(false))
</script>

<template>
  <div class="nc-table-toolbar w-full py-1 flex gap-1 items-center h-[var(--toolbar-height)] px-2 border-b" style="z-index: 7">
    <SmartsheetToolbarFieldsMenu v-if="isGrid || isGallery" :show-system-fields="false" class="ml-1" />

    <SmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery" />

    <SmartsheetToolbarSortListMenu v-if="isGrid || isGallery" />

    <SmartsheetToolbarShareView v-if="(isForm || isGrid) && !isPublic" />

    <SmartsheetToolbarMoreActions v-if="(isGrid && !isPublic) || (isGrid && isPublic && allowCSVDownload)" />
    <div class="flex-1" />
    <SmartsheetToolbarSearchData v-if="(isGrid || isGallery) && !isPublic" class="shrink mr-2" />
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
