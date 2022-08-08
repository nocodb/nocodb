<script setup lang="ts">
import { IsFormInj, IsGridInj } from '~/context'

const isForm = inject(IsFormInj)
const isGrid = inject(IsGridInj)
</script>

<template>
  <div class="nc-table-toolbar w-full py-1 flex gap-1 items-center" style="z-index: 7">
    <SmartsheetToolbarSearchData class="flex-shrink" />

    <SmartsheetToolbarFieldsMenu :show-system-fields="false" />

    <SmartsheetToolbarColumnFilterMenu />

    <SmartsheetToolbarSortListMenu />

    <SmartsheetToolbarShareView v-if="isForm || isGrid" />

    <SmartsheetToolbarMoreActions />

    <div class="flex-1" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}
</style>
