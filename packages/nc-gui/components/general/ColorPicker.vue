<script lang="ts" setup>
import tinycolor from 'tinycolor2'

interface Props {
  modelValue?: string | any
  colors?: string[]
  rowSize?: number
  advanced?: boolean
  pickButton?: boolean
  colorBoxBorder?: boolean
  isNewDesign?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => enumColor.light[0],
  colors: () => enumColor.light.concat(enumColor.dark),
  rowSize: 10,
  advanced: true,
  pickButton: false,
  colorBoxBorder: false,
  isNewDesign: false,
})

const emit = defineEmits(['input', 'closeModal'])

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('input', val || null)
  },
})

const picked = ref<string>(props.modelValue || enumColor.light[0])

const selectColor = (color: string, closeModal = false) => {
  picked.value = color
  if (props.pickButton) vModel.value = color
  if (closeModal) {
    emit('closeModal')
  }
}

const isPickerOn = ref(false)

const compare = (colorA: string, colorB: string) =>
  colorA.toLowerCase() === colorB.toLowerCase() || colorA.toLowerCase() === tinycolor(colorB).toHex8String().toLowerCase()

watch(picked, (n, _o) => {
  vModel.value = n
})
</script>

<template>
  <div class="color-picker">
    <div
      v-for="colId in Math.ceil(props.colors.length / props.rowSize)"
      :key="colId"
      class="color-picker-row"
      :class="{
        'mt-2': colId > 1,
      }"
    >
      <div
        v-for="(color, i) of colors.slice((colId - 1) * rowSize, colId * rowSize)"
        :key="`color-${colId}-${i}`"
        class="p-1 rounded-md flex h-8"
        :class="{
          'hover:bg-gray-200': isNewDesign,
        }"
      >
        <button
          class="color-selector"
          :class="{ 'selected': compare(picked, color), 'new-design': isNewDesign }"
          :style="{
            backgroundColor: `${color}`,
            border: colorBoxBorder ? `1px solid ${tinycolor(color).darken(30).toString()}` : undefined,
          }"
          @click="selectColor(color, true)"
        >
          {{ compare(picked, color) && !isNewDesign ? '&#10003;' : '' }}
        </button>
      </div>
      <div
        class="p-1 rounded-md h-8"
        :class="{
          'hover:bg-gray-200': isNewDesign,
        }"
      >
        <button class="nc-more-colors-trigger h-6 w-6 border-1 border-gray-400 rounded" @click="isPickerOn = !isPickerOn">
          <GeneralTooltip>
            <template #title>{{ $t('activity.moreColors') }}</template>
            <div class="flex items-center justify-center">
              <GeneralIcon :icon="isPickerOn ? 'minus' : 'plus'" class="w-4 h-4" />
            </div>
          </GeneralTooltip>
        </button>
      </div>
    </div>

    <a-card
      v-if="props.advanced"
      class="w-full mt-2"
      :body-style="{ paddingLeft: '4px !important', paddingRight: '4px !important' }"
      :bordered="false"
    >
      <div v-if="isPickerOn" class="flex justify-center">
        <LazyGeneralChromeWrapper v-model="picked" class="!w-full !shadow-none" />
      </div>
    </a-card>
  </div>
</template>

<style lansg="scss" scoped>
.color-picker {
  @apply flex flex-col items-center justify-center bg-white p-2.5;
}
.color-picker-row {
  @apply flex flex-row space-x-1;
}
.color-selector {
  @apply h-6 w-6 rounded;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: white;
}
.color-selector:hover {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}
.color-selector:focus,
.color-selector.selected,
.nc-more-colors-trigger:focus {
  outline: none;
  box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
}

:deep(.vc-chrome-toggle-icon) {
  @apply !ml-3;
}
</style>
