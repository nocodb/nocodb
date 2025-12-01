<script setup lang="ts">
import type { Validation } from 'nocodb-sdk'

interface Props {
  type: Validation['type']
}
const props = defineProps<Props>()

const { type } = toRefs(props)

const { getActiveFieldValidationErrors } = useFormViewStoreOrThrow()

const validationInputError = computed(() => {
  return getActiveFieldValidationErrors(type.value)
})
</script>

<template>
  <div v-if="validationInputError.length" class="mt-1 validation-input-error text-nc-content-red-medium flex flex-col">
    <span v-for="(error, i) in validationInputError" :key="i"> {{ error }} </span>
  </div>
</template>
