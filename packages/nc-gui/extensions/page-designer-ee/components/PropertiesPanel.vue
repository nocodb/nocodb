<script setup lang="ts">
import TextProperties from './widgets/TextProperties.vue'
</script>

<template>
  <div class="properties-panel w-[420px]">
    <TextProperties :index="0" />
  </div>
</template>

<style lang="scss" scoped>
.properties-panel {
  border-left: 1px solid;
  @apply border-nc-border-gray-medium;
}
</style>
