<script lang="ts" setup>
import { isValidHexColour, normalizeHexColour } from 'nocodb-sdk'

interface Props {
  modelValue: string | null | undefined
}

const props = defineProps<Props>()

const column = inject(ColumnInj)!
const rowHeight = inject(RowHeightInj, ref(undefined))

const colourMeta = computed(() => {
  const meta = parseProp(column.value?.meta)
  return {
    displayFormat: meta?.displayFormat || 'swatch_hex',
    swatchStyle: meta?.swatchStyle || 'circle',
    swatchSize: meta?.swatchSize || 'medium',
    defaultColor: meta?.defaultColor || '#FFFFFF',
    ...meta,
  }
})

const isValidHex = computed(() => isValidHexColour(props.modelValue))

const displayValue = computed(() => {
  if (!props.modelValue) return null
  return normalizeHexColour(props.modelValue) || null
})

const sizeClass = computed(() => {
  switch (colourMeta.value.swatchSize) {
    case 'small':
      return 'w-4 h-4'
    case 'large':
      return 'w-6 h-6'
    default:
      return 'w-5 h-5'
  }
})

const shapeClass = computed(() => {
  return colourMeta.value.swatchStyle === 'square' ? 'rounded-sm' : 'rounded-full'
})

const showSwatch = computed(() => {
  return colourMeta.value.displayFormat !== 'hex_only' && isValidHex.value
})

const showHex = computed(() => {
  return colourMeta.value.displayFormat !== 'swatch_only'
})
</script>

<template>
  <div
    class="nc-cell-field flex items-center gap-2 w-full h-full"
    :style="{
      'max-width': '100%',
      'overflow': 'hidden',
    }"
  >
    <div
      v-if="showSwatch && displayValue"
      :class="[sizeClass, shapeClass]"
      :style="{ backgroundColor: displayValue }"
      class="flex-shrink-0 border-1 border-gray-300"
    />

    <span
      v-if="showHex && props.modelValue"
      class="text-sm font-mono truncate"
      :style="{
        'display': '-webkit-box',
        'max-width': '100%',
        '-webkit-line-clamp': rowHeight ? rowHeightTruncateLines(rowHeight, true) : undefined,
        '-webkit-box-orient': 'vertical',
        'overflow': 'hidden',
      }"
    >
      {{ props.modelValue }}
    </span>
  </div>
</template>
