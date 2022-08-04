<script lang="ts" setup>
import { Chrome } from '@ckpack/vue-color'
import { enumColor } from '@/utils'

interface Props {
  modelValue: String
  colors?: String[]
  rowSize?: number
  advanced?: Boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => enumColor.light[0],
  colors: () => enumColor.light.concat(enumColor.dark),
  rowSize: () => 10,
  advanced: () => true,
})

const emit = defineEmits(['update:modelValue'])
const vModel = useVModel(props, 'modelValue', emit)

const picked = ref(props.modelValue || enumColor.light[0])

const select = (color: any) => {
  picked.value = color.hex ? color.hex : color
  vModel.value = color.hex ? color.hex : color
}

const compare = (colorA: String, colorB: String) => {
  if ((typeof colorA === 'string' || colorA instanceof String) && (typeof colorB === 'string' || colorB instanceof String)) {
    return colorA.toLowerCase() === colorB.toLowerCase()
  }
  return false
}
</script>

<template>
  <div class="color-picker">
    <div v-for="colId in Math.ceil(props.colors.length / props.rowSize)" :key="colId" class="color-picker-row">
      <button
        v-for="(color, i) in colors.slice((colId - 1) * rowSize, colId * rowSize)"
        :key="`color-${colId}-${i}`"
        class="color-selector"
        :class="compare(picked, color) ? 'selected' : ''"
        :style="{ 'background-color': `${color}` }"
        @click="select(color)"
      >
        {{ compare(picked, color) ? '&#10003;' : '' }}
      </button>
    </div>
    <a-card v-if="props.advanced" class="w-full shadow-lg mt-2" :body-style="{ padding: '0px' }">
      <a-collapse accordion ghost expand-icon-position="right">
        <a-collapse-panel key="1" header="Advanced" class="">
          <a-button class="!bg-primary text-white w-full" @click="select(picked)"> Pick Color </a-button>
          <div class="flex justify-center py-4">
            <Chrome v-model="picked" />
          </div>
        </a-collapse-panel>
      </a-collapse>
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
  height: 32px;
  width: 32px;
  margin: 10px 5px;
  border-radius: 5px;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: white;
}
.color-selector:hover {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}
.color-selector.selected {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}
</style>
