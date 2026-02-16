<script lang="ts" setup>
import { iconMap } from '~/utils/iconUtils'

interface Props {
  modelValue: string | null | undefined
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj, ref())
const readOnly = inject(ReadonlyInj, ref(false))
const editEnabled = inject(EditModeInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))
const isEditColumn = inject(EditColumnInj, ref(false))

const colourMeta = computed(() => {
  const meta = column.value?.meta ? parseProp(column.value.meta) : {}
  return {
    displayFormat: meta?.displayFormat || 'swatch_hex',
    swatchStyle: meta?.swatchStyle || 'circle',
    swatchSize: meta?.swatchSize || 'medium',
    defaultColor: meta?.defaultColor || '#FFFFFF',
    ...meta,
  }
})

const vModel = computed({
  get: () => {
    const value = props.modelValue || colourMeta.value.defaultColor || '#FFFFFF'
    // Normalize to hex format
    if (value && typeof value === 'string' && value.startsWith('#') && value.length === 7) {
      return value.toUpperCase()
    }
    if (value && typeof value === 'string' && /^[0-9A-Fa-f]{6}$/.test(value)) {
      return `#${value.toUpperCase()}`
    }
    return '#FFFFFF'
  },
  set: (val) => {
    if (!val) {
      emit('update:modelValue', null)
      return
    }

    const colorStr = String(val).trim()

    // Accept 6 or 8 digit hex (strip alpha channel if present)
    const hexMatch = colorStr.match(/^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/)
    if (hexMatch) {
      emit('update:modelValue', `#${hexMatch[1].toUpperCase()}`)
    }
  },
})

const isOpen = ref(false)
const tempColor = ref<string | null>(null)
const showClearButton = ref(false)
const pickerKey = ref(0)

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

const showSwatch = computed(() => colourMeta.value.displayFormat !== 'hex_only')

const showHex = computed(() => colourMeta.value.displayFormat !== 'swatch_only')

const openColorPicker = () => {
  if (!readOnly.value) {
    pickerKey.value++
    tempColor.value = vModel.value
    isOpen.value = true
    showClearButton.value = false
  }
}

const onClick = (e: Event) => {
  e.stopPropagation()
  if (!readOnly.value && props.modelValue) {
    // In edit column context (default value), open the picker directly
    if (isEditColumn.value) {
      openColorPicker()
    } else {
      showClearButton.value = true
    }
  }
}

const clearValue = (e: Event) => {
  e.stopPropagation()
  emit('update:modelValue', null)
  showClearButton.value = false
}

const openPicker = () => {
  if (!readOnly.value) {
    tempColor.value = vModel.value
    isOpen.value = true
    showClearButton.value = false
  }
}

const hideClearButton = () => {
  showClearButton.value = false
}

const onColorChange = (color: string) => {
  tempColor.value = color
}

const onSave = () => {
  if (tempColor.value) {
    vModel.value = tempColor.value
  }
  isOpen.value = false
  editEnabled.value = false
}

const onClose = () => {
  isOpen.value = false
  editEnabled.value = false
}

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

// Auto-open color picker when cell becomes editable (only in grid view, not in expanded form or edit column)
watch(
  editEnabled,
  (enabled) => {
    if (enabled && !readOnly.value && !isOpen.value && !isExpandedFormOpen.value && !isEditColumn.value) {
      nextTick(() => {
        openColorPicker()
      })
    }
  },
  { immediate: true },
)

// Sync editEnabled with modal open state and manage keyboard listener
watch(isOpen, (open) => {
  if (open) {
    if (!editEnabled.value) {
      editEnabled.value = true
    }
    document.addEventListener('keydown', onKeyDown)
  } else {
    document.removeEventListener('keydown', onKeyDown)
  }
})

onMounted(() => {
  document.addEventListener('click', hideClearButton)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('click', hideClearButton)
})
</script>

<template>
  <div class="nc-cell-field flex items-center gap-2 py-1 w-full relative">
    <!-- Color Display -->
    <div
      class="flex items-center gap-2 flex-1"
      :class="{ 'cursor-pointer': !readOnly, 'pointer-events-none': readOnly }"
      @click="props.modelValue ? onClick($event) : openPicker()"
    >
      <div
        v-if="showSwatch"
        :class="[sizeClass, shapeClass]"
        :style="{ backgroundColor: vModel, border: '1px solid #d0d5dd' }"
        class="flex-shrink-0"
      />

      <span v-if="showHex" class="text-sm font-mono truncate">
        {{ vModel }}
      </span>
    </div>

    <!-- Clear Button (X) -->
    <div
      v-if="showClearButton && props.modelValue && !readOnly"
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
      wrap-class-name="nc-colour-picker-modal !z-1060"
    >
      <div v-if="isOpen" class="px-2 pt-2 pb-0" @click.stop @mousedown.stop>
        <GeneralAdvanceColorPicker :key="pickerKey" :model-value="tempColor || vModel" :is-open="isOpen" @input="onColorChange" />
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
