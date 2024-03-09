<script lang="ts" setup>
import { computed, enumColor, ref, watch } from '#imports'

interface Props {
  modelValue?: string | any
  colors?: string[]
  rowSize?: number
  advanced?: boolean
  pickButton?: boolean
  borders?: string[]
  isNewDesign?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => enumColor.light[0],
  colors: () => enumColor.light.concat(enumColor.dark),
  rowSize: 10,
  advanced: true,
  pickButton: false,
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

const compare = (colorA: string, colorB: string) => colorA.toLowerCase() === colorB.toLowerCase()

watch(picked, (n, _o) => {
  vModel.value = n
})
</script>

<template>
  <div class="color-picker">
    <div v-for="colId in Math.ceil(props.colors.length / props.rowSize)" :key="colId" class="color-picker-row">
      <button
        v-for="(color, i) of colors.slice((colId - 1) * rowSize, colId * rowSize)"
        :key="`color-${colId}-${i}`"
        class="color-selector"
        :class="{ 'selected': compare(picked, color), 'new-design': isNewDesign }"
        :style="{
          'background-color': `${color}`,
          'border': borders?.length && borders[i] ? `1px solid ${borders[i]}` : undefined,
        }"
        @click="selectColor(color, true)"
      >
        {{ compare(picked, color) && !isNewDesign ? '&#10003;' : '' }}
      </button>
      <button class="h-6 w-6 mt-2.7 ml-1 border-1 border-[grey] rounded-md" @click="isPickerOn = !isPickerOn">
        <GeneralTooltip>
          <template #title>{{ $t('activity.moreColors') }}</template>
          <div class="flex items-center justify-center">
            <GeneralIcon :icon="isPickerOn ? 'minus' : 'plus'" class="w-4 h-4" />
          </div>
        </GeneralTooltip>
      </button>
    </div>

    <a-card v-if="props.advanced" class="w-full mt-2" :body-style="{ padding: '0px' }" :bordered="false">
      <div v-if="isPickerOn" class="flex justify-center">
        <LazyGeneralChromeWrapper v-model="picked" class="!w-full !shadow-none" />
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.color-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: white;
  padding: 10px;
}
.color-picker-row {
  display: flex;
  flex-direction: row;
}
.color-selector {
  position: relative;
  height: 25px;
  width: 25px;
  margin: 10px 5px;
  border-radius: 5px;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: white;
}
.color-selector:hover {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}

.color-selector.selected:not(.new-design) {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}
.color-selector:focus.new-design {
  outline: none;
  box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
}
.color-selector.selected.new-design {
  box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
}
:deep(.vc-chrome-toggle-icon) {
  @apply ml-3!important;
}
</style>
