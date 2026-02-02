<script setup lang="ts">
interface Props {
  modelValue: string | null | undefined
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!
const readOnly = inject(ReadonlyInj, ref(false))
const editEnabled = inject(EditModeInj, ref(false))

const colourMeta = computed(() => {
  const meta = parseProp(column.value?.meta)
  return {
    displayFormat: meta?.displayFormat || 'swatch_hex',
    swatchStyle: meta?.swatchStyle || 'circle',
    swatchSize: meta?.swatchSize || 'medium',
    defaultColor: meta?.defaultColor || '#ffffff',
    ...meta,
  }
})

const vModel = computed({
  get: () => {
    const value = modelValue || colourMeta.value.defaultColor
    // Normalize to hex format
    if (value && value.startsWith('#') && value.length === 7) {
      return value.toUpperCase()
    }
    return '#FFFFFF'
  },
  set: (val) => {
    // Validate hex color format
    if (val && /^#[0-9A-Fa-f]{6}$/.test(val)) {
      emit('update:modelValue', val.toUpperCase())
    } else if (!val) {
      emit('update:modelValue', null)
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

const showSwatch = computed(() => {
  return colourMeta.value.displayFormat === 'swatch_hex' || colourMeta.value.displayFormat === 'swatch_only'
})

const showHex = computed(() => {
  return colourMeta.value.displayFormat === 'swatch_hex' || colourMeta.value.displayFormat === 'hex_only'
})

const openColorPicker = () => {
  if (!readOnly.value) {
    isOpen.value = true
  }
}

const onColorChange = (color: string) => {
  vModel.value = color
  isOpen.value = false
  editEnabled.value = false
}

const onClose = () => {
  isOpen.value = false
  editEnabled.value = false
}

// Handle cell click to open color picker
const onClick = () => {
  if (!readOnly.value && !editEnabled.value) {
    openColorPicker()
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
  <div class="nc-cell-field flex items-center gap-2 py-1 w-full">
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

    <!-- Color Picker Dropdown -->
    <LazyGeneralAdvanceColorPicker
      v-model="isOpen"
      :value="vModel"
      :advanced="false"
      @input="onColorChange"
      @close="onClose"
    />
  </div>
</template>