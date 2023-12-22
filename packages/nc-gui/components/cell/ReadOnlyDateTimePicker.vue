<script setup lang="ts">
import { ReadonlyInj, provide, ref } from '#imports'

interface Props {
  modelValue?: string | null
}

defineProps<Props>()

provide(ReadonlyInj, ref(true))
</script>

<template>
  <CellDateTimePicker :model-value="modelValue" :is-pk="false" />
</template>
