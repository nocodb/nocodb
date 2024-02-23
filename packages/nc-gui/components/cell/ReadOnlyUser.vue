<script setup lang="ts">
import { ActiveCellInj, EditModeInj, ReadonlyInj, provide, ref } from '#imports'

interface Props {
  modelValue?: string | null
}

defineProps<Props>()

provide(ReadonlyInj, ref(true))

provide(EditModeInj, ref(false))

provide(ActiveCellInj, ref(false))
</script>

<template>
  <div class="relative w-full">
    <LazyCellUser class="z-0" :model-value="modelValue" />
    <div class="w-full h-full z-1 absolute top-0 left-0"></div>
  </div>
</template>
