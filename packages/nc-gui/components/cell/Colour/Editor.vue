<script lang="ts" setup>
interface Props {
  modelValue: string | null | undefined
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj, ref())
const readOnly = inject(ReadonlyInj, ref(false))
const editEnabled = inject(EditModeInj, ref(false))
const isForm = inject(IsFormInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

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
    const value = props.modelValue || colourMeta.value.defaultColor || '#3366FF'
    console.log('vModel get - modelValue:', props.modelValue, 'returning:', value)
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
const tempColor = ref<string | null>(null)

const sizeClass = computed(() => {
  switch (colourMeta.value.swatchSize) {
    case 'small':
      return 'w-4 h-4'
    case 'large':
      return 'w-6 h-6'
    default:
      return 'w-5 h-5' // medium
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
    console.log('Opening color picker, readOnly:', readOnly.value)
    tempColor.value = vModel.value
    isOpen.value = true
    console.log('isOpen set to:', isOpen.value)
  } else {
    console.log('Cannot open color picker - readOnly:', readOnly.value)
  }
}

const onColorChange = (color: string) => {
  console.log('Color changed to:', color)
  tempColor.value = color
}

const onSave = () => {
  console.log('Saving color:', tempColor.value)
  if (tempColor.value) {
    vModel.value = tempColor.value
  }
  isOpen.value = false
  editEnabled.value = false
}

const onClose = () => {
  console.log('Closing color picker without saving')
  isOpen.value = false
  editEnabled.value = false
}

// Handle keyboard events for Enter (save) and Escape (cancel)
const onKeyDown = (e: KeyboardEvent) => {
  if (!isOpen.value) return
  
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    onSave()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }
}

// Auto-open color picker when cell becomes editable
watch(
  editEnabled,
  (enabled) => {
    if (enabled && !readOnly.value && !isOpen.value) {
      nextTick(() => {
        openColorPicker()
      })
    } else if (!enabled && isOpen.value) {
      // Prevent closing modal if editEnabled becomes false while modal is open
      console.log('editEnabled became false while modal is open - keeping modal open')
    }
  },
  { immediate: true },
)

// Prevent editEnabled from being set to false while modal is open
watch(isOpen, (open) => {
  if (open && !editEnabled.value) {
    editEnabled.value = true
  }
})

// Add keyboard event listener when modal is open
watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeyDown)
  } else {
    document.removeEventListener('keydown', onKeyDown)
  }
})

// Clean up event listener on unmount
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="nc-cell-field flex items-center gap-2 py-1 w-full relative">
    <!-- Color Display -->
    <div
      class="flex items-center gap-2 cursor-pointer w-full"
      :class="{ 'pointer-events-none': readOnly }"
      @click="openColorPicker"
    >
      <div
        v-if="showSwatch"
        :class="[sizeClass, shapeClass]"
        :style="{ backgroundColor: vModel }"
        class="border border-gray-300 flex-shrink-0"
      />

      <span v-if="showHex" class="text-sm font-mono truncate flex-1">
        {{ vModel }}
      </span>
    </div>
    <!-- Color Picker Modal -->
    <a-modal
      :visible="isOpen"
      :closable="false"
      :keyboard="false"
      :mask-closable="false"
      :width="400"
      wrap-class-name="nc-colour-picker-modal !z-1060"
    >
      <div v-if="isOpen" class="px-2 pt-2 pb-0" @click.stop @mousedown.stop>
        <GeneralAdvanceColorPicker :model-value="tempColor || vModel" :is-open="isOpen" @input="onColorChange" />
      </div>
      <template #footer>
        <div class="flex items-center gap-2 pt-3" @click.stop @mousedown.stop>
          <NcButton type="secondary" size="small" @click="onClose"> {{ $t('general.cancel') }} </NcButton>
          <div class="flex-1" />
          <NcButton type="primary" size="small" @click="onSave"> {{ $t('general.save') }} </NcButton>
        </div>
      </template>
    </a-modal>
  </div>
</template>
