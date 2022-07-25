<script setup lang="ts"></script>

<template>
  <div dense class="nc-table-toolbar w-100 p-1 flex gap-1" style="z-index: 7">
    <SmartsheetToolbarFieldsMenu :show-system-fields="false" />
    <SmartsheetToolbarColumnFilterMenu />
    <SmartsheetToolbarSortListMenu />
  </div>
</template>

<style scoped></style>
