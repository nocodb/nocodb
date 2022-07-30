<template>
  <div class="flex gap-2">
    <SmartsheetToolbarLockMenu />

    <div class="dot" />

    <SmartsheetToolbarReload />

    <div class="dot" />

    <SmartsheetToolbarAddRow />

    <div class="dot" />

    <SmartsheetToolbarDeleteTable />

    <div class="dot" />

    <SmartsheetToolbarToggleDrawer />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}

.dot {
  @apply w-[3px] h-[3px] bg-gray-300 rounded-full;
}
</style>
