<script lang="ts" setup>
import { isValidHexColour, normalizeHexColour } from 'nocodb-sdk'
import { iconMap } from '~/utils/iconUtils'

interface Props {
  modelValue: string | null | undefined
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj, ref())

const colourMeta = computed(() => {
  const meta = column.value?.meta ? parseProp(column.value.meta) : {}
  return {
    swatchStyle: meta?.swatchStyle || 'circle',
    swatchSize: meta?.swatchSize || 'medium',
    ...meta,
  }
})

const vModel = computed({
  get: () => props.modelValue || '',
  set: (val) => {
    emit('update:modelValue', val || null)
  },
})

const shapeClass = computed(() => {
  return colourMeta.value.swatchStyle === 'square' ? 'rounded-sm' : 'rounded-full'
})

const isValidHex = computed(() => isValidHexColour(vModel.value))

// --- Colour picker (shared composable) ---
const disabledRef = computed(() => !!props.disabled)

const { isOpen, tempColor, pickerKey, openColorPicker, onColorChange, save, close } = useColourPicker({
  onSave: (colour) => {
    vModel.value = colour
  },
  disabled: disabledRef,
})

const onTextInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value.trim()
  if (!raw) {
    vModel.value = null
    return
  }
  // Normalise to #RRGGBB uppercase so filter matches stored values.
  // Accepts input with or without '#' prefix (e.g. 'ff5733' → '#FF5733').
  const normalized = normalizeHexColour(raw)
  vModel.value = normalized ?? raw.toUpperCase()
}
</script>

<template>
  <div class="nc-cell-field flex items-center gap-1 w-full h-full">
    <!-- Colour swatch button to open picker -->
    <div
      class="flex-shrink-0 w-5 h-5 cursor-pointer flex items-center justify-center"
      :class="{ 'pointer-events-none opacity-50': disabled }"
      @click.stop="openColorPicker(isValidHex ? vModel : '#FFFFFF')"
    >
      <div v-if="isValidHex" :class="shapeClass" :style="{ backgroundColor: vModel }" class="w-4 h-4 border-1 border-gray-300" />
      <component :is="iconMap.palette" v-else class="w-4 h-4 text-nc-content-gray-muted" />
    </div>

    <!-- Text input for manual hex entry -->
    <input
      :value="vModel"
      :disabled="disabled"
      type="text"
      placeholder="#FFFFFF"
      class="flex-1 h-full bg-transparent border-none !focus:(border-none outline-none ring-transparent) text-sm font-mono nc-cell-field !pl-0"
      @input="onTextInput"
      @keydown.stop
      @mousedown.stop
    />

    <!-- Color Picker Dropdown -->
    <NcDropdown
      v-model:visible="isOpen"
      :auto-close="false"
      use-backdrop
      overlay-class-name="nc-colour-picker-dropdown !rounded-xl"
    >
      <div class="sr-only w-5 h-5"></div>
      <template #overlay>
        <div>
          <GeneralAdvanceColorPicker :key="pickerKey" :model-value="tempColor" :is-open="isOpen" @input="onColorChange" />
          <div
            class="flex items-center justify-end gap-2 mt-3 p-2 border-t border-nc-border-gray-medium"
            @click.stop
            @mousedown.stop
          >
            <NcButton type="secondary" size="small" @click="close"> {{ $t('general.cancel') }} </NcButton>
            <NcButton type="primary" size="small" @click="save"> {{ $t('general.save') }} </NcButton>
          </div>
        </div>
      </template>
    </NcDropdown>
  </div>
</template>
