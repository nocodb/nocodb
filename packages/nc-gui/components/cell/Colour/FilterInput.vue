<script lang="ts" setup>
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

const isOpen = ref(false)
const tempColor = ref<string | null>(null)
const pickerKey = ref(0)

const shapeClass = computed(() => {
  return colourMeta.value.swatchStyle === 'square' ? 'rounded-sm' : 'rounded-full'
})

const isValidHex = computed(() => {
  return vModel.value && /^#[0-9A-Fa-f]{6}$/i.test(vModel.value)
})

const openColorPicker = () => {
  if (props.disabled) return
  pickerKey.value++
  tempColor.value = isValidHex.value ? vModel.value : '#FFFFFF'
  isOpen.value = true
}

const onColorChange = (color: string) => {
  tempColor.value = color
}

const onSave = () => {
  if (tempColor.value) {
    const hexMatch = tempColor.value.match(/^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/)
    if (hexMatch) {
      vModel.value = `#${hexMatch[1].toUpperCase()}`
    }
  }
  isOpen.value = false
}

const onClose = () => {
  isOpen.value = false
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

const onTextInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value.trim()
  vModel.value = val || null
}

watch(isOpen, (open) => {
  if (open) {
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
  <div class="nc-cell-field flex items-center gap-1 w-full h-full">
    <!-- Colour swatch button to open picker -->
    <div
      class="flex-shrink-0 w-5 h-5 cursor-pointer flex items-center justify-center"
      :class="{ 'pointer-events-none opacity-50': disabled }"
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

    <!-- Text input for manual hex entry -->
    <input
      :value="vModel"
      :disabled="disabled"
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
        <GeneralAdvanceColorPicker :key="pickerKey" :model-value="tempColor" :is-open="isOpen" @input="onColorChange" />
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
