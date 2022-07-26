<script setup lang="ts"></script>

<template>
  <div dense class="nc-table-toolbar w-100 p-1 flex gap-1 align-center" style="z-index: 7">
    <SmartsheetToolbarSearchData class="flex-shrink" />
    <SmartsheetToolbarFieldsMenu :show-system-fields="false" />
    <SmartsheetToolbarColumnFilterMenu />
    <SmartsheetToolbarSortListMenu />
    <SmartsheetToolbarShareView />
    <SmartsheetToolbarMoreActions />
    <div class="flex-1" />
    <SmartsheetToolbarLockMenu />
    <div class="dot" />
    <SmartsheetToolbarReload />
    <div class="dot" />
    <SmartsheetToolbarAddRow />
    <div class="dot" />
    <SmartsheetToolbarDeleteTable />
    <div class="dot" />
    <SmartsheetToolbarToggleDrawer class="mr-2" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}
.dot {
  @apply w-[3px] h-[3px] bg-gray-300 mx-1 rounded-full;
}
</style>
