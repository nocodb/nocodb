<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

interface Props {
  column: ColumnType
}
const props = defineProps<Props>()

const { column } = toRefs(props)

const { v$ } = useFormViewStoreOrThrow()

const fieldHasConfigError = computed(() => {
  if (!column.value?.id) return false

  return !!v$.value?.[column.value.id]?.$error
})
</script>

<template>
  <div
    v-if="fieldHasConfigError"
    class="mt-2 validation-error text-[#CB3F36] bg-[#FFF2F1] rounded-lg inline-flex items-center gap-2 px-2 py-1"
  >
    <GeneralIcon icon="alertTriangle" />
    <div class="flex">Configuration error in field validations</div>
  </div>
</template>
