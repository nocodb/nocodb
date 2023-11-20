<script lang="ts" setup>
import { CurrentCellInj, ref } from '#imports'

const el = ref()

provide(CurrentCellInj, el)
</script>

<template>
  <div ref="el" class="select-none">
    <slot />
  </div>
</template>
