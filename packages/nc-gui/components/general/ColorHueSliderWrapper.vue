<script lang="ts" setup>
import { Slider } from '@ckpack/vue-color'
import tinycolor from 'tinycolor2'

interface Props {
  modelValue?: any
  mode?: 'hsl' | 'hsv'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ h: 199, s: 0, v: 0 }),
  mode: () => 'hsv',
})

const emit = defineEmits(['update:modelValue', 'input'])

const picked = computed({
  get: () => props.modelValue || { h: 199, s: 0, v: 0 },
  set: (val) => {
    emit('update:modelValue', val[props.mode] || null)
    emit('input', val[props.mode] || null)
  },
})
</script>

<template>
  <Slider
    v-model="picked"
    class="nc-hue-slider-wrapper min-w-[200px]"
    :style="{
      ['--nc-hue-slider-pointer-color']: tinycolor(`hsv(${picked.h ?? 199}, 100%, 100%)`).toHexString(),
    }"
  />
</template>

<style lang="scss" scoped>
.nc-hue-slider-wrapper {
  &.vc-slider {
    @apply !w-full;
  }
  :deep(.vc-slider-swatches) {
    @apply hidden;
  }

  :deep(.vc-slider-hue-warp) {
    @apply h-1.5;
    .vc-hue {
      @apply rounded-lg;
    }
    .vc-hue-pointer {
      top: -3px !important;
    }
    .vc-hue-picker {
      background-color: white;
      box-shadow: 0 0 0 3px var(--nc-hue-slider-pointer-color) !important;
    }
  }
}
</style>
