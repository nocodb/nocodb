<script setup lang="ts">
const { commandPalette } = useCommandPalette()
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
    <div class="flex items-center gap-2 text-sm">
      <GeneralIcon icon="ncCommand" />
      K
    </div>
  </NcButton>
</template>
