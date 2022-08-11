<script setup lang="ts">
import { useSmartsheetStoreOrThrow } from '~/composables'

const { isGrid, isForm } = useSmartsheetStoreOrThrow()
</script>

<template>
  <div class="nc-table-toolbar w-full py-1 flex gap-1 items-center h-[48px] px-2" style="z-index: 7">
    <SmartsheetToolbarSearchData v-if="isGrid" class="shrink mr-2" />

    <SmartsheetToolbarFieldsMenu v-if="isGrid" :show-system-fields="false" />

    <SmartsheetToolbarColumnFilterMenu v-if="isGrid" />

    <SmartsheetToolbarSortListMenu v-if="isGrid" />

    <SmartsheetToolbarShareView v-if="isForm || isGrid" />

    <SmartsheetToolbarMoreActions v-if="isGrid" />

    <div class="flex-1" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}
</style>
