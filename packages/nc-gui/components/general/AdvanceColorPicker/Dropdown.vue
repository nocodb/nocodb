<script lang="ts" setup>
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

const isOpenColorPicker = ref(false)
</script>

<template>
  <NcDropdown
    v-model:visible="isOpenColorPicker"
    :auto-close="false"
    overlay-class-name="nc-select-option-color-picker"
    :disabled="isLoadingPredictOptions"
  >
    <button
      type="button"
      class="p-1 inline-flex content-center items-center justify-center aspect-square rounded-md min-w-[30px] min-h-[30px] hover:border-gray-200 border-2"
      :style="{
        'background-color': vModel,
      }"
    >
      <GeneralIcon
        class="w-[16px] h-[16px]"
        :style="{
          'color': '#FFFFFF',
          'mix-blend-mode': 'difference',
        }"
        icon="ncChevronDown"
      />
    </button>
    <template #overlay>
      <GeneralAdvanceColorPicker v-model="vModel" :is-open="isOpenColorPicker" @input="(_color:string)=>vModel=_color">
      </GeneralAdvanceColorPicker>
    </template>
  </NcDropdown>
</template>
