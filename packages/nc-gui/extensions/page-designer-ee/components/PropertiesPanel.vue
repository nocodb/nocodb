<script setup lang="ts">
import PageDesignerTextProperties from './widgets/PageDesignerTextProperties.vue'
</script>

<template>
  <div class="properties-panel w-[420px]">
    <PageDesignerTextProperties :index="0" />
  </div>
</template>

<style lang="scss" scoped>
.properties-panel {
  border-left: 1px solid;
  @apply border-nc-border-gray-medium;
}
</style>
