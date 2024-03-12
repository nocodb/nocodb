<script lang="ts" setup>
import tinycolor from 'tinycolor2'

import { BASE_ICON_COLOR_HUE_DATA as preDefinedHueData } from '#imports'

const props = defineProps<{
  hue?: number | null
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  readonly?: boolean
  disableClearing?: boolean
  iconClass?: string
}>()

const emit = defineEmits(['colorSelected'])

const { hue, size = 'medium', readonly } = props

const defaultHueColor = {
  h: 199,
  s: 79,
  v: 100,
}

const defaultHueValue = 199

const isOpen = ref(false)

const colorRef = ref({
  ...defaultHueColor,
  h: !(hue !== 0 && !hue) ? hue : defaultHueValue,
})

const updateColorHue = (value?: string | number | null) => {
  colorRef.value.h = !isNaN(parseInt(`${value}`)) ? +Math.min(parseInt(`${value}`), 360) : 0
}

function selectColor(value: number) {
  colorRef.value.h = value

  emit('colorSelected', value)

  isOpen.value = false
}

const onClick = (e: Event) => {
  if (readonly) return

  e.stopPropagation()

  isOpen.value = !isOpen.value
}

watch(
  isOpen,
  (value) => {
    if (!value && colorRef.value.h !== hue) {
      emit('colorSelected', colorRef.value.h)
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <a-dropdown v-model:visible="isOpen" :trigger="['click']" :disabled="readonly">
    <div
      class="flex flex-row justify-center items-center select-none rounded-md nc-emoji"
      :class="{
        'hover:bg-gray-500 hover:bg-opacity-15 cursor-pointer': !readonly,
        'bg-gray-500 bg-opacity-15': isOpen,
        'h-6 w-6 text-lg': size === 'small',
        'h-8 w-8 text-xl': size === 'medium',
        'h-10 w-10 text-2xl': size === 'large',
        'h-14 w-16 text-5xl': size === 'xlarge',
      }"
      @click.stop="onClick"
    >
      <template v-if="hue !== 0 && !hue && colorRef.h === defaultHueValue">
        <slot name="default" />
      </template>
      <template v-else>
        <svg width="16" height="16" viewBox="0 0 1073 1073" fill="none" xmlns="http://www.w3.org/2000/svg" :class="iconClass">
          <mask
            id="mask0_1749_80944"
            style="mask-type: luminance"
            maskUnits="userSpaceOnUse"
            x="94"
            y="40"
            width="885"
            height="993"
          >
            <path d="M978.723 40H94V1033H978.723V40Z" fill="white" />
          </mask>
          <g mask="url(#mask0_1749_80944)">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M638.951 291.265L936.342 462.949C966.129 480.145 980.256 502.958 978.723 525.482V774.266C980.256 796.789 966.129 819.602 936.342 836.798L638.951 1008.48C582.292 1041.19 490.431 1041.19 433.773 1008.48L136.381 836.798C106.595 819.602 92.4675 796.789 93.9999 774.266L93.9999 525.482C92.4675 502.957 106.595 480.145 136.381 462.949L433.773 291.265C490.431 258.556 582.292 258.556 638.951 291.265Z"
              :fill="
                tinycolor(
                  preDefinedHueData && preDefinedHueData[`_${colorRef.h}`]
                    ? `hsv(${preDefinedHueData[`_${colorRef.h}`].shade.h},${preDefinedHueData[`_${colorRef.h}`].shade.s}%, ${
                        preDefinedHueData[`_${colorRef.h}`].shade.v
                      }%)`
                    : `hsv(${colorRef.h ?? defaultHueValue}, 100%, 30%)`,
                ).toHexString()
              "
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M638.951 65.0055L936.342 236.69C966.129 253.886 980.256 276.699 978.723 299.222V548.006C980.256 570.529 966.129 593.343 936.342 610.538L638.951 782.223C582.292 814.931 490.431 814.931 433.773 782.223L136.381 610.538C106.595 593.343 92.4675 570.529 93.9999 548.006L93.9999 299.222C92.4675 276.699 106.595 253.886 136.381 236.69L433.773 65.0055C490.431 32.2968 582.292 32.2968 638.951 65.0055Z"
              :fill="
                tinycolor(
                  preDefinedHueData && preDefinedHueData[`_${colorRef.h}`]
                    ? `hsv(${preDefinedHueData[`_${colorRef.h}`].tint.h},${preDefinedHueData[`_${colorRef.h}`].tint.s}%, ${
                        preDefinedHueData[`_${colorRef.h}`].tint.v
                      }%)`
                    : `hsv(${colorRef.h ?? defaultHueValue}, 50%, 100%)`,
                ).toHexString()
              "
            />
          </g>
        </svg>
      </template>
    </div>
    <template #overlay>
      <div class="relative bg-white rounded-lg border-1 border-gray-200 shadow-lg">
        <div class="flex items-center p-2 space-x-2">
          <div
            v-for="(h, i) of Object.keys(preDefinedHueData)"
            :key="i"
            class="nc-pre-defined-hue-item p-1 rounded cursor-pointer hover:bg-gray-200"
          >
            <div
              class="rounded h-6 w-6"
              :class="{
                selected: preDefinedHueData[h].tint.h === hue || (h === '_199' && hue !== 0 && !hue),
              }"
              :style="{
                backgroundColor: preDefinedHueData[h].pickerColor,
              }"
              @click="selectColor(preDefinedHueData[h].tint.h)"
            ></div>
          </div>
        </div>

        <div class="p-2 border-t-1 border-gray-200 flex flex-col space-y-4">
          <div class="uppercase text-xs font-medium">{{ $t('labels.customColour') }}</div>

          <div class="flex flex-row items-center gap-x-3">
            <input
              :value="parseInt(`${colorRef.h ?? 0}`)"
              class="nc-color-hue-input"
              type="number"
              @input="
                (value) => {
                  updateColorHue(value.target?.value)
                }
              "
              :min="0"
              :max="360"
            />

            <LazyGeneralColorSliderWrapper
              :model-value="colorRef"
              class="!min-w-none ml-3"
              @update:model-value="
                (value) => {
                  updateColorHue(value?.h)
                }
              "
            />
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style lang="scss" scoped>
.nc-pre-defined-hue-item,
.nc-custom-hue-picker-item {
  .selected {
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3069fe;
  }
}

.nc-color-hue-input {
  @apply outline-none text-sm rounded-lg border-gray-200 py-1 px-3 w-14 text-center;
  -moz-appearance: textfield;

  &:focus {
    @apply ring-transparent border-brand-500;
  }

  /* Chrome, Safari, Edge, Opera */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
