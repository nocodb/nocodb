<script setup lang="ts">
import { ReadonlyInj, provide, ref, EditModeInj, ActiveCellInj } from '#imports'

interface Props {
  modelValue?: string | null
}

defineProps<Props>()

provide(ReadonlyInj, ref(true))

provide(EditModeInj, ref(true))

provide(ActiveCellInj, ref(true))

</script>

<template>
  <LazyCellDateTimePicker :model-value="modelValue" :is-pk="false" />
</template>
