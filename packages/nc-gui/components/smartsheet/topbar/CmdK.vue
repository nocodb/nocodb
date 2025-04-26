<script setup lang="ts">
const { commandPalette } = useCommandPalette()
const { isMobileMode } = useGlobal()
</script>

<template>
  <NcButton
    v-e="['c:quick-actions']"
    type="secondary"
    size="small"
    class="nc-topbar-cmd-k-btn"
    data-testid="nc-topbar-cmd-k-btn"
    @click="commandPalette?.open()"
  >
    <div class="flex items-center gap-1 text-sm">
      <GeneralIcon icon="ncCommand" class="h-3.5" />
      <span v-if="!isMobileMode">K</span>
      <span v-else class="sr-only">K</span>
    </div>
  </NcButton>
</template>
