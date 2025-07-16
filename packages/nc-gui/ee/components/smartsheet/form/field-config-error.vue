<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  mode: 'preview' | 'list'
}
const props = defineProps<Props>()

const { column, mode } = toRefs(props)

const { v$, isRequired } = useFormViewStoreOrThrow()

const visibilityError = computed(() => {
  return parseProp(column.value?.meta)?.visibility?.errors || {}
})

const requiredFieldEditRestricted = computed(() => {
  return isRequired(column.value, column.value?.required) && !column.value?.permissions?.isAllowedToEdit
})

const fieldConfigError = computed(() => {
  if (!column.value?.id) return { hasError: false, msgs: [] }

  const msgs = Array.from(
    new Set((v$.value?.[column.value.id]?.meta?.validators?.$errors || []).filter((v) => v.$message).map((v) => v.$message)),
  )
  return { hasError: !!v$.value?.[column.value.id]?.$error, msgs }
})

const firstErrorMsg = computed(() => {
  if (requiredFieldEditRestricted.value) {
    return 'This required field isn’t editable, which may cause submission errors during form submission.'
  }

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
    <div
      v-if="
        fieldConfigError?.hasError ||
        Object.keys(visibilityError ?? {}).length ||
        !column?.permissions?.isAllowedToEdit ||
        requiredFieldEditRestricted
      "
      class="flex flex-col gap-2 mt-2"
    >
      <NcTooltip
        v-if="fieldConfigError?.hasError || Object.keys(visibilityError ?? {}).length || requiredFieldEditRestricted"
        :disabled="!firstErrorMsg"
        class="flex cursor-pointer"
        placement="bottomLeft"
        :arrow-point-at-center="false"
      >
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

      <div
        v-if="!column?.permissions?.isAllowedToEdit"
        class="nc-field-config-error validation-error text-[#CB3F36] inline-flex items-center gap-2"
      >
        <GeneralIcon icon="info" />
        <div class="flex">{{ column?.permissions?.label }}</div>
      </div>
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
