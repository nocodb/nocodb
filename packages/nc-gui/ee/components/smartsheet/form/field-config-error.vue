<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  mode: 'preview' | 'list'
}
const props = defineProps<Props>()

const { column, mode } = toRefs(props)

const { v$ } = useFormViewStoreOrThrow()

const visibilityError = computed(() => {
  return parseProp(column.value?.meta)?.visibility?.errors || {}
})

const fieldConfigError = computed(() => {
  if (!column.value?.id) return { hasError: false, msgs: [] }

  const msgs = Array.from(
    new Set((v$.value?.[column.value.id]?.meta?.validators?.$errors || []).filter((v) => v.$message).map((v) => v.$message)),
  )
  return { hasError: !!v$.value?.[column.value.id]?.$error, msgs }
})

const firstErrorMsg = computed(() => {
  const visibilityErr = Object.values(visibilityError.value ?? [])
  if (visibilityErr.length) {
    return visibilityErr[0]
  }

  if (fieldConfigError.value?.msgs?.length) {
    return fieldConfigError.value.msgs[0]
  }
})
</script>

<template>
  <template v-if="mode === 'preview'">
    <div v-if="fieldConfigError?.hasError || Object.keys(visibilityError ?? {}).length" class="flex mt-2">
      <NcTooltip :disabled="!firstErrorMsg" class="flex cursor-pointer" placement="bottom">
        <template #title>
          <div class="flex flex-col">
            {{ firstErrorMsg }}
          </div>
        </template>
        <div
          class="nc-field-config-error validation-error text-[#CB3F36] bg-[#FFF2F1] rounded-lg inline-flex items-center gap-2 px-2 py-1"
        >
          <GeneralIcon icon="alertTriangle" />
          <div class="flex">Configuration error</div>
        </div>
      </NcTooltip>
    </div>
  </template>
  <template v-else>
    <GeneralIcon
      v-if="fieldConfigError?.hasError || Object.keys(visibilityError ?? {}).length"
      icon="alertTriangle"
      class="ml-1 flex-none !text-red-500"
    />
  </template>
</template>
