<script lang="ts" setup>
import { ROW_COLORS } from '../../../constants/row-colors'

interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: number): void
  (event: 'click', model: ClickEvent): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const onColorClick = (event: ClickEvent, color: string) => {
  vModel.value = color
  emits('click', event)
}
const buttonBorderClass = (color) => {
  if (color === vModel.value) {
    return 'border-blue-500'
  } else {
    return 'border-transparent'
  }
}
</script>

<template>
  <div class="inline-block relative bg-white p-2">
    <div class="w-auto grid grid-cols-[1fr,1fr,1fr,1fr,1fr,1fr,1fr,1fr,1fr,1fr] grid-rows-[1fr,1fr,1fr,1fr]">
      <template v-for="color of ROW_COLORS" :key="color">
        <button
          type="button"
          class="!p-2 border-2 hover:bg-gray-200"
          :class="[buttonBorderClass(color)]"
          @click="onColorClick($evt, color)"
        >
          <div class="min-h-[24px] min-w-[24px] h-[24px] w-[24px] rounded-md" :class="[`bg-${color}`]"></div>
        </button>
      </template>
    </div>
  </div>
</template>