<script lang="ts" setup>
import { ROW_COLORS } from '../../constants/row-colors'

interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const onColorClick = (color) => {
  vModel.value = color
}
</script>

<template>
  <div class="inline-block relative bg-white p-2">
    <div class="w-auto grid grid-cols-[1fr,1fr,1fr,1fr,1fr,1fr,1fr,1fr,1fr,1fr] grid-rows-[1fr,1fr,1fr,1fr]">
      <template v-for="color of ROW_COLORS" :key="color">
        <button type="button" class="!p-2 hover:bg-gray-200" @click="onColorClick(color)">
          <div class="min-h-[24px] min-w-[24px] h-[24px] w-[24px] rounded-md" :class="[`bg-${color}`]"></div>
        </button>
      </template>
    </div>
  </div>
</template>
