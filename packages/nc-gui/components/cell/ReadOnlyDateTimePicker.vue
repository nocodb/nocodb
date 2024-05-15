<script setup lang="ts">
interface Props {
  modelValue?: string | null
}

defineProps<Props>()

provide(ReadonlyInj, ref(true))

provide(EditModeInj, ref(false))

provide(ActiveCellInj, ref(false))
</script>

<template>
  <div class="relative">
    <LazyCellDateTimePicker class="z-0" :model-value="modelValue" :is-pk="false" />
    <div class="w-full h-full z-1 absolute top-0 left-0"></div>
  </div>
</template>
