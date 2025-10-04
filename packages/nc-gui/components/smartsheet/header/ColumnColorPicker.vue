<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { parseProp, stringifyProp } from '~/utils/parseUtils'

const props = defineProps<{
  column: ColumnType
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = useVModel(props, 'visible', emit)

const { $api } = useNuxtApp()
const { t } = useI18n()
const { getMeta } = useMetas()

const meta = inject(MetaInj, ref())

const isLoading = ref(false)

// Predefined color options
const colorOptions = [
  '#fef2f2',
  '#fef7f0',
  '#fffbeb',
  '#f0fdf4',
  '#f0f9ff',
  '#f8fafc',
  '#f1f5f9',
  '#f8fafc',
  '#faf5ff',
  '#fdf2f8',
  '#ffffff',
  '#f9fafb',
  '#f3f4f6',
  '#e5e7eb',
  '#d1d5db',
  '#9ca3af',
  '#6b7280',
  '#4b5563',
  '#374151',
  '#1f2937',
  '#111827',
  '#000000',
]

const currentColor = computed(() => {
  const columnMeta = parseProp(props.column.meta || {})
  return columnMeta.columnColor || null
})

const updateColumnColor = async (color: string | null) => {
  if (isLoading.value) return

  isLoading.value = true

  try {
    const columnMeta = parseProp(props.column.meta || {})

    if (color) {
      columnMeta.columnColor = color
    } else {
      delete columnMeta.columnColor
    }

    await $api.dbTableColumn.update(props.column.id!, {
      meta: stringifyProp(columnMeta),
    })

    // Update local meta
    if (meta.value?.columns) {
      const columnIndex = meta.value.columns.findIndex((c) => c.id === props.column.id)
      if (columnIndex !== -1) {
        meta.value.columns[columnIndex].meta = stringifyProp(columnMeta)
      }
    }

    // Reload meta to ensure consistency
    await getMeta(meta.value?.id as string, true)

    visible.value = false
  } catch (e) {
    console.error('Failed to update column color:', e)
    message.error(t('msg.error.columnColorUpdateFailed'))
  } finally {
    isLoading.value = false
  }
}

const clearColor = () => {
  updateColumnColor(null)
}
</script>

<template>
  <NcModal v-model:visible="visible" :title="t('labels.setColumnColor')" size="small" class="nc-column-color-picker-modal">
    <div class="flex flex-col gap-4 p-4">
      <div class="text-sm text-gray-600">
        {{ t('labels.chooseColumnColor', { column: column.title }) }}
      </div>

      <!-- Color grid -->
      <div class="grid grid-cols-10 gap-2">
        <button
          v-for="color in colorOptions"
          :key="color"
          class="w-8 h-8 rounded border-2 transition-all hover:scale-110"
          :class="{
            'border-blue-500 ring-2 ring-blue-200': currentColor === color,
            'border-gray-300': currentColor !== color,
          }"
          :style="{ backgroundColor: color }"
          @click="updateColumnColor(color)"
        />
      </div>

      <!-- Current color display -->
      <div v-if="currentColor" class="flex items-center gap-2 p-2 bg-gray-50 rounded">
        <div class="text-sm text-gray-600">{{ t('labels.currentColor') }}:</div>
        <div class="w-6 h-6 rounded border border-gray-300" :style="{ backgroundColor: currentColor }" />
        <div class="text-sm font-mono text-gray-700">{{ currentColor }}</div>
      </div>

      <!-- Clear color button -->
      <div v-if="currentColor" class="flex justify-end">
        <NcButton type="text" size="small" :loading="isLoading" @click="clearColor">
          {{ t('labels.clearColor') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped>
.nc-column-color-picker-modal :deep(.nc-modal-body) {
  @apply p-0;
}
</style>
