<script setup lang="ts">
import { IsPublicInj, useSmartsheetStoreOrThrow } from '#imports'
import ToggleDrawer from '~/components/smartsheet/sidebar/toolbar/ToggleDrawer.vue'

const { isGrid, isForm, isGallery } = useSmartsheetStoreOrThrow()
const isPublic = inject(IsPublicInj, ref(false))
const { allowCSVDownload } = useSharedView()

const { isOpen } = useSidebar()
</script>

<template>
  <div
    class="nc-table-toolbar w-full py-1 flex gap-1 items-center h-[var(--toolbar-height)] px-2 border-b overflow-x-hidden"
    style="z-index: 7"
  >
    <SmartsheetToolbarViewActions
      v-if="(isGrid && !isPublic) || (isGrid && isPublic && allowCSVDownload)"
      :show-system-fields="false"
      class="ml-1"
    />

    <SmartsheetToolbarFieldsMenu v-if="isGrid || isGallery" :show-system-fields="false" class="ml-1" />

    <SmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery" />

    <SmartsheetToolbarSortListMenu v-if="isGrid || isGallery" />

    <SmartsheetToolbarShareView v-if="(isForm || isGrid) && !isPublic" />

    <div class="flex-1" />

    <SmartsheetToolbarReload v-if="!isPublic" class="mx-1" />
    <SmartsheetToolbarAddRow v-if="!isPublic" class="mx-1" />

    <SmartsheetToolbarSearchData v-if="(isGrid || isGallery) && !isPublic" class="shrink mr-2 ml-2" />

    <ToggleDrawer v-if="!isOpen && !isPublic" class="mr-2" />
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
