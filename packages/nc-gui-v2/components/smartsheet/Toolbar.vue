<script setup lang="ts">
import { useSmartsheetStoreOrThrow } from '~/composables'

const { isGrid, isForm } = useSmartsheetStoreOrThrow()
</script>

<template>
  <div class="nc-table-toolbar w-full py-1 flex gap-1 items-center h-[48px]" style="z-index: 7">



    <SmartsheetToolbarFieldsMenu :show-system-fields="false" />

    <SmartsheetToolbarColumnFilterMenu />

    <SmartsheetToolbarSortListMenu />

    <SmartsheetToolbarShareView v-if="isForm || isGrid" />



    <div class="dot"/>
    <SmartsheetSidebarToolbarReload  />

    <div class="dot"/>

    <SmartsheetSidebarToolbarAddRow />
    <div class="dot"/>



    <SmartsheetSidebarToolbarLockMenu />

    <div class="dot"/>




    <SmartsheetToolbarMoreActions />

    <div class="flex-1"></div>


    <SmartsheetToolbarSearchData class="flex-shrink" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}
.dot{
  @apply w-[3px] h-[3px] bg-gray-300 rounded-full
}
</style>
