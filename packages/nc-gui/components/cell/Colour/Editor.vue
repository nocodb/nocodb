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
const isForm = inject(IsFormInj, ref(false))

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
const pickerKey = ref(0)

const shapeClass = computed(() => {
  return colourMeta.value.swatchStyle === 'square' ? 'rounded-sm' : 'rounded-full'
})

const openColorPicker = () => {
  if (!readOnly.value) {
    pickerKey.value++
    tempColor.value = vModel.value
    isOpen.value = true
  }
}

const isValidHex = computed(() => {
  return props.modelValue && /^#[0-9A-Fa-f]{6}$/i.test(props.modelValue)
})

const onTextInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value.trim()
  if (!val) {
    emit('update:modelValue', null)
    return
  }
  // Accept with or without # prefix
  const hexMatch = val.match(/^#?([0-9A-Fa-f]{6})$/)
  if (hexMatch) {
    emit('update:modelValue', `#${hexMatch[1].toUpperCase()}`)
  }
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
    if (enabled && !readOnly.value && !isOpen.value && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
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

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="nc-cell-field flex items-center gap-1 w-full h-full relative">
    <!-- Colour swatch button to open picker -->
    <div
      class="flex-shrink-0 w-5 h-5 cursor-pointer flex items-center justify-center"
      :class="{ 'pointer-events-none opacity-50': readOnly }"
      @click.stop="openColorPicker"
    >
      <div
        v-if="isValidHex"
        :class="shapeClass"
        :style="{ backgroundColor: vModel, border: '1px solid #d0d5dd' }"
        class="w-4 h-4"
      />
      <component :is="iconMap.palette" v-else class="w-4 h-4 text-nc-content-gray-muted" />
    </div>

    <!-- Editable text input for manual hex entry -->
    <input
      :value="props.modelValue || ''"
      :disabled="readOnly"
      type="text"
      placeholder="#FFFFFF"
      class="flex-1 h-full border-none outline-none bg-transparent text-sm font-mono nc-cell-field"
      @input="onTextInput"
      @keydown.stop
      @mousedown.stop
    />

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
