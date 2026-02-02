<script setup lang="ts">
interface Props {
  modelValue: string | null | undefined
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj, ref())
const readOnly = inject(ReadonlyInj, ref(false))
const editEnabled = inject(EditModeInj, ref(false))

const colourMeta = computed(() => {
  try {
    const meta = column.value?.meta ? parseProp(column.value.meta) : {}
    return {
      displayFormat: meta?.displayFormat || 'swatch_hex',
      swatchStyle: meta?.swatchStyle || 'circle',
      swatchSize: meta?.swatchSize || 'medium',
      defaultColor: meta?.defaultColor || '#3366FF',
      ...meta,
    }
  } catch (e) {
    console.error('Error parsing colour meta:', e)
    return {
      displayFormat: 'swatch_hex',
      swatchStyle: 'circle',
      swatchSize: 'medium',
      defaultColor: '#3366FF',
    }
  }
})

const vModel = computed({
  get: () => {
    const value = modelValue || colourMeta.value.defaultColor || '#3366FF'
    console.log('vModel get - modelValue:', modelValue, 'returning:', value)
    // Normalize to hex format
    if (value && typeof value === 'string' && value.startsWith('#') && value.length === 7) {
      return value.toUpperCase()
    }
    // If value doesn't start with #, try to add it
    if (value && typeof value === 'string' && /^[0-9A-Fa-f]{6}$/.test(value)) {
      return `#${value.toUpperCase()}`
    }
    return '#3366FF'
  },
  set: (val) => {
    console.log('vModel set - received:', val, 'type:', typeof val)

    if (!val) {
      emit('update:modelValue', null)
      return
    }

    // Convert to string if not already
    const colorStr = String(val).trim()

    // Check if it's a valid hex color (6 or 8 digits, with or without #)
    // 8 digits includes alpha channel (RRGGBBAA) - we'll strip the alpha
    const hexMatch = colorStr.match(/^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/)
    if (hexMatch) {
      // Use only the RGB part (first 6 digits), ignore alpha channel if present
      const normalized = `#${hexMatch[1].toUpperCase()}`
      console.log('Emitting color:', normalized)
      emit('update:modelValue', normalized)
    } else {
      console.warn('Invalid color format:', colorStr)
    }
  },
})

const isOpen = ref(false)

const sizeClass = computed(() => {
  switch (colourMeta.value.swatchSize) {
    case 'small': return 'w-4 h-4'
    case 'large': return 'w-6 h-6'
    default: return 'w-5 h-5' // medium
  }
})

const shapeClass = computed(() => {
  return colourMeta.value.swatchStyle === 'square' ? 'rounded-sm' : 'rounded-full'
})

// Always show both swatch and hex by default for debugging
const showSwatch = computed(() => {
  try {
    const format = colourMeta.value?.displayFormat
    // Default to true if format is undefined or matches expected values
    return format !== 'hex_only'
  } catch (e) {
    console.error('Error in showSwatch:', e)
    return true
  }
})

const showHex = computed(() => {
  try {
    const format = colourMeta.value?.displayFormat
    // Default to true if format is undefined or matches expected values
    return format !== 'swatch_only'
  } catch (e) {
    console.error('Error in showHex:', e)
    return true
  }
})

const openColorPicker = () => {
  if (!readOnly.value) {
    isOpen.value = true
  }
}

const onColorChange = (color: string) => {
  console.log('Color changed to:', color)
  vModel.value = color
  // Don't close immediately - let user continue selecting
}

const onClose = () => {
  console.log('Closing color picker')
  isOpen.value = false
  editEnabled.value = false
}

// Handle cell click to open color picker
const onClick = () => {
  console.log('onClick triggered, readOnly:', readOnly.value, 'isOpen before:', isOpen.value)
  if (!readOnly.value) {
    isOpen.value = true
    console.log('isOpen set to:', isOpen.value)
  }
}

// Auto-open color picker when cell becomes editable
watch(editEnabled, (enabled) => {
  if (enabled && !readOnly.value && !isOpen.value) {
    nextTick(() => {
      openColorPicker()
    })
  }
})
</script>

<template>
  <div class="nc-cell-field flex items-center gap-2 py-1 w-full relative">
    <!-- Color Display -->
    <div
      class="flex items-center gap-2 w-full"
      :class="{ 'cursor-pointer': !readOnly, 'pointer-events-none': readOnly }"
      @click="onClick"
    >
      <div
        v-if="showSwatch"
        :class="[sizeClass, shapeClass]"
        :style="{ backgroundColor: vModel }"
        class="border border-gray-300 flex-shrink-0"
      />

      <span
        v-if="showHex"
        class="text-sm font-mono truncate flex-1"
      >
        {{ vModel }}
      </span>
    </div>

    <!-- Color Picker Modal -->
    <a-modal
      :visible="isOpen"
      :footer="null"
      :closable="true"
      :destroy-on-close="true"
      :width="400"
      wrap-class-name="nc-colour-picker-modal"
      @update:visible="(val) => isOpen = val"
      @cancel="onClose"
    >
      <div v-if="isOpen" class="p-2">
        <GeneralAdvanceColorPicker
          :model-value="vModel"
          :is-open="isOpen"
          @input="onColorChange"
          @close-modal="onClose"
        />
      </div>
    </a-modal>
  </div>
</template>