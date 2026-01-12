<script setup lang="ts">
const { commandPalette } = useCommandPalette()
</script>

<template>
  <NcButton
    v-e="['c:quick-actions']"
    type="text"
    size="xsmall"
    class="nc-sidebar-top-button w-full !hover:bg-nc-bg-gray-medium !rounded-md !xs:hidden !h-7 my-0.5"
    data-testid="nc-sidebar-search-btn"
    :centered="false"
    @click="commandPalette?.open()"
  >
    <div class="flex items-center gap-2">
      <MaterialSymbolsSearch class="!h-3.9" />
      Quick Actions
      <div
        class="inline-flex gap-1 justify-center text-xs px-[8px] py-[1px] uppercase border-1 border-nc-border-gray-dark rounded-md bg-slate-150 text-nc-content-gray-muted"
      >
        <kbd class="text-[16px] mt-[0.5px]">⌘</kbd>
        <kbd class="!leading-4">K</kbd>
      </div>
    </div>
  </NcButton>
</template>
