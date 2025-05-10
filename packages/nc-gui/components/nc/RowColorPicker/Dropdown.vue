<script lang="ts" setup>
interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const iconColor = computed(() => {
  if (!vModel.value) {
    return 'text-gray-800'
  }
  const selectedColorArray = vModel.value?.split('-')
  const selectedColorWeight = selectedColorArray[selectedColorArray.length - 1]
  if (Number(selectedColorWeight) < 500) {
    return 'text-gray-800'
  } else {
    return 'text-gray-300'
  }
})
</script>

<template>
  <NcDropdown>
    <button
      type="button"
      class="p-1 inline-flex content-center items-center justify-center aspect-square rounded-md min-w-[30px] min-h-[30px] hover:border-gray-200 border-2"
      :class="[`bg-${vModel}`]"
    >
      <GeneralIcon class="w-[16px] h-[16px]" :class="[iconColor]" icon="ncChevronDown" />
    </button>
    <template #overlay>
      <NcRowColorPicker v-model="vModel" />
    </template>
  </NcDropdown>
</template>
