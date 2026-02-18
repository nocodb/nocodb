<script setup lang="ts">
import { iconMap } from '~/utils/iconUtils'

interface Props {
  modelValue: string | null | undefined
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj, ref())
const readOnly = inject(ReadonlyInj, ref(false))
const editEnabled = inject(EditModeInj, ref(false))
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
const tempColor = ref<string | null>(null)

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
    tempColor.value = vModel.value
    isOpen.value = true
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

// Handle cell click to open color picker
// State for showing clear button
const showClearButton = ref(false)

const onClick = (e: Event) => {
  e.stopPropagation()
  console.log('onClick triggered, readOnly:', readOnly.value, 'modelValue:', modelValue)
  if (!readOnly.value && modelValue) {
    // Show clear button when clicking on a cell with value
    showClearButton.value = true
  }
}

// Clear the colour value
const clearValue = (e: Event) => {
  e.stopPropagation()
  emit('update:modelValue', null)
  showClearButton.value = false
}

// Open color picker
const openPicker = () => {
  if (!readOnly.value) {
    tempColor.value = vModel.value
    isOpen.value = true
    showClearButton.value = false
  }
}

// Hide clear button when clicking outside
const hideClearButton = () => {
  showClearButton.value = false
}

// Add event listener for clicking outside
onMounted(() => {
  document.addEventListener('click', hideClearButton)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', hideClearButton)
})

// Auto-open color picker when cell becomes editable (only in grid view, not in expanded form)
watch(
  editEnabled,
  (enabled) => {
    if (enabled && !readOnly.value && !isOpen.value && !isExpandedFormOpen.value) {
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
</script>

<template>
  <div class="nc-cell-field flex items-center gap-2 py-1 w-full relative" @click.stop>
    <!-- Color Display -->
    <div
      class="flex items-center gap-2 flex-1"
      :class="{ 'cursor-pointer': !readOnly, 'pointer-events-none': readOnly }"
      @click="modelValue ? onClick : openPicker"
    >
      <div
        v-if="showSwatch"
        :class="[sizeClass, shapeClass]"
        :style="{ backgroundColor: vModel }"
        class="border border-gray-300 flex-shrink-0"
      />

      <span
        v-if="showHex"
        class="text-sm font-mono truncate"
      >
        {{ vModel }}
      </span>
    </div>

    <!-- Clear Button (X) -->
    <div
      v-if="showClearButton && modelValue && !readOnly"
      class="flex items-center justify-center w-5 h-5 rounded cursor-pointer text-nc-content-gray-muted hover:text-nc-content-gray hover:bg-gray-100"
      @click="clearValue"
    >
      <component :is="iconMap.close" class="w-3 h-3" />
    </div>
    

    <!-- Color Picker Modal -->
    <a-modal
      :visible="isOpen"
      :closable="false"
      :keyboard="false"
      :mask-closable="false"
      :width="400"
      wrap-class-name="nc-colour-picker-modal"
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