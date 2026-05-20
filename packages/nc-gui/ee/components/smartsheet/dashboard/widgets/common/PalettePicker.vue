<script setup lang="ts">
import { CHART_PALETTE_OPTIONS } from '~/lib/constants'
import PalettePreview from './PalettePreview.vue'

type PreviewKind = 'bar' | 'line' | 'pie' | 'donut' | 'scatter'

interface Props {
  modelValue: string
  preview?: PreviewKind
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 'default',
  preview: 'pie',
})

const emits = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const { t } = useI18n()

const vModel = computed({
  get: () => props.modelValue,
  set: (v: string) => emits('update:modelValue', v),
})

const paletteLabel = (value: string) => t(`general.chartPalette.${value}`)

const onChange = (v: string) => emits('change', v)
</script>

<template>
  <NcSelect
    v-model:value="vModel"
    class="nc-palette-select"
    dropdown-class-name="nc-palette-select-dropdown"
    @change="onChange"
  >
    <a-select-option
      v-for="opt in CHART_PALETTE_OPTIONS"
      :key="opt.value"
      :value="opt.value"
      :label="paletteLabel(opt.value)"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <PalettePreview :colors="opt.colors" :preview="preview" size="sm" />
        <span class="text-bodySm text-nc-content-gray font-medium truncate">{{ paletteLabel(opt.value) }}</span>
      </div>
    </a-select-option>
  </NcSelect>
</template>

<style lang="scss">
.nc-palette-select-dropdown {
  .ant-select-item {
    @apply !py-2 !px-2.5;
  }
}
</style>
