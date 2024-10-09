<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  mode: 'preview' | 'list'
}
const props = defineProps<Props>()

const { column, mode } = toRefs(props)

const visibilityError = computed(() => {
  return parseProp(column.value?.meta)?.visibility?.errors || {}
})

const firstErrorMsg = computed(() => {
  const visibilityErr = Object.values(visibilityError.value ?? [])
  if (visibilityErr.length) {
    return visibilityErr[0]
  }
})
</script>

<template>
  <template v-if="mode === 'preview'">
    <div v-if="Object.keys(visibilityError ?? {}).length" class="flex mt-2">
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
    <GeneralIcon v-if="Object.keys(visibilityError ?? {}).length" icon="alertTriangle" class="ml-1 flex-none !text-red-500" />
  </template>
</template>
