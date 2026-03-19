<script lang="ts" setup>
import { isValidHexColour, normalizeHexColour, normalizeHexColourWithAlpha } from 'nocodb-sdk'
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
    return normalizeHexColour(value) || '#FFFFFF'
  },
  set: (val) => {
    if (!val) {
      emit('update:modelValue', null)
      return
    }
    // Accept 6 or 8 digit hex (strip alpha channel if present via the picker)
    const normalized = normalizeHexColourWithAlpha(val)
    if (normalized) {
      emit('update:modelValue', normalized)
    }
  },
})

const shapeClass = computed(() => {
  return colourMeta.value.swatchStyle === 'square' ? 'rounded-sm' : 'rounded-full'
})

const isValidHex = computed(() => isValidHexColour(props.modelValue))

// --- Colour picker (shared composable) ---
const { isOpen, tempColor, pickerKey, openColorPicker, onColorChange, save, close } = useColourPicker({
  onSave: (colour) => {
    vModel.value = colour
  },
  onClose: () => {
    editEnabled.value = false
  },
  disabled: readOnly,
})

const onTextInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value.trim()
  if (!val) {
    emit('update:modelValue', null)
    return
  }
  const normalized = normalizeHexColour(val)
  if (normalized) {
    emit('update:modelValue', normalized)
  }
}

// Auto-open color picker when cell becomes editable (only in grid view, not in expanded form or edit column)
watch(
  editEnabled,
  (enabled) => {
    if (enabled && !readOnly.value && !isOpen.value && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
      nextTick(() => {
        openColorPicker(vModel.value)
      })
    }
  },
  { immediate: true },
)

// Sync editEnabled with modal open state
watch(isOpen, (open) => {
  if (open && !editEnabled.value) {
    editEnabled.value = true
  }
})
</script>

<template>
  <div class="nc-cell-field flex items-center gap-1 w-full h-full relative">
    <!-- Colour swatch button to open picker -->
    <div
      class="flex-shrink-0 w-5 h-5 cursor-pointer flex items-center justify-center"
      :class="{ 'pointer-events-none opacity-50': readOnly }"
      @click.stop="openColorPicker(vModel)"
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
      class="flex-1 h-full border-none !outline-none focus:outline-none focus:ring-0 bg-transparent text-sm font-mono nc-cell-field !pl-0"
      @input="onTextInput"
      @keydown.stop
      @mousedown.stop
    />

    <!-- Color Picker Modal -->
    <a-modal
      :visible="isOpen"
      :closable="false"
      :keyboard="false"
      :width="338"
      wrap-class-name="nc-colour-picker-modal !z-1060"
      destroy-on-close
      @cancel="close"
    >
      <div class="py-1" @click.stop @mousedown.stop>
        <GeneralAdvanceColorPicker :key="pickerKey" :model-value="tempColor || vModel" :is-open="isOpen" @input="onColorChange" />
      </div>
      <template #footer>
        <div class="flex items-center justify-end" @click.stop @mousedown.stop>
          <NcButton type="secondary" size="small" @click="close"> {{ $t('general.cancel') }} </NcButton>
          <NcButton type="primary" size="small" @click="save"> {{ $t('general.save') }} </NcButton>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<style lang="scss">
.nc-colour-picker-modal {
  .ant-modal-content {
    @apply !p-0;
  }
  .ant-modal-footer {
    @apply px-2;
  }
}
</style>
