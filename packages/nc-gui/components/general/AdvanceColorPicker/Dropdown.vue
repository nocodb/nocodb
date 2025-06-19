<script lang="ts" setup>
interface Props {
  modelValue?: string | null
  disabled?: boolean
}

interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: string): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const slots = useSlots()

const slotHasChildren = (name?: string) => {
  return (slots[name ?? 'default']?.()?.length ?? 0) > 0
}

const isOpenColorPicker = ref(false)
const onColorChange = (value: string) => {
  vModel.value = value
  emits('change', value)
}
</script>

<template>
  <NcDropdown
    v-model:visible="isOpenColorPicker"
    :auto-close="false"
    :disabled="disabled"
    overlay-class-name="nc-select-option-color-picker"
  >
    <slot></slot>
    <template v-if="!slotHasChildren()">
      <button
        type="button"
        class="p-1 inline-flex content-center items-center justify-center aspect-square rounded-md min-w-[30px] min-h-[30px] hover:border-gray-200 border-2"
        :style="{
          ...vModel ? ({'background-color': vModel!}) : {},
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
    </template>
    <template #overlay>
      <GeneralAdvanceColorPicker v-model="vModel" :is-open="isOpenColorPicker" @input="onColorChange">
      </GeneralAdvanceColorPicker>
    </template>
  </NcDropdown>
</template>
