<script setup lang="ts">
import { useSmartsheetStoreOrThrow } from '~/composables'
import { IsPublicInj } from '~/context'

const { isGrid, isForm, isGallery } = useSmartsheetStoreOrThrow()
const isPublic = inject(IsPublicInj, ref(false))
</script>

<template>
  <div class="nc-table-toolbar w-full py-1 flex gap-1 items-center h-[48px] px-2 border-b" style="z-index: 7">
    <SmartsheetToolbarFieldsMenu v-if="(isGrid && !isPublic) || isGallery" :show-system-fields="false" class="ml-1" />

    <SmartsheetToolbarColumnFilterMenu v-if="(isGrid && !isPublic) || isGallery" />

    <SmartsheetToolbarSortListMenu v-if="(isGrid && !isPublic) || isGallery" />

    <SmartsheetToolbarShareView v-if="(isForm || isGrid) && !isPublic" />

    <SmartsheetToolbarMoreActions v-if="isGrid" />
    <div class="flex-1" />
    <SmartsheetToolbarSearchData v-if="isGrid || isGallery" class="shrink mr-2" />
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
