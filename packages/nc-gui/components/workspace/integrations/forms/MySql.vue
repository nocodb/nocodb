<script lang="ts" setup>
const { activeIntegration } = useIntegrationsPage()
</script>

<template>
  <div class="panels">
    <div class="panel">DUMMY</div>
  </div>
</template>

<style lang="scss" scoped>
.panels {
  @apply w-3/4 flex flex-col;

  .panel {
    @apply border-1 border-gray-200 p-6 rounded-lg;
  }
}
</style>
