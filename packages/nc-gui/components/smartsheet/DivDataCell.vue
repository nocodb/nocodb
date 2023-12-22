<script lang="ts" setup>
import { CurrentCellInj, ref } from '#imports'

const el = ref()

provide(CurrentCellInj, el)
</script>

<template>
  <div ref="el" class="select-none nc-data-cell">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500 !rounded-lg !shadow-none !ring-0;
}
.nc-data-cell {
  @apply border-1 border-gray-200 overflow-hidden rounded-lg;
}
</style>
