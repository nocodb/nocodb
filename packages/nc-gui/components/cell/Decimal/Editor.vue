<script lang="ts" setup>
interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null
  placeholder?: string
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const editEnabled = inject(EditModeInj, ref(false))
const column = inject(ColumnInj, null)!
const isEditColumn = inject(EditColumnInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isForm = inject(IsFormInj)!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))

const inputRef = ref<HTMLInputElement>()
const vModel = useVModel(props, 'modelValue', emits)

const precision = computed(() => {
  return parseProp(column?.value.meta).precision ?? 1
})

onMounted(() => {
  if (canvasCellEventData?.keyboardKey && isSinglePrintableKey(canvasCellEventData?.keyboardKey)) {
    vModel.value = Number(canvasCellEventData.keyboardKey)
  }
  if (isCanvasInjected && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value?.focus()
  }
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <CellDecimalInput
    v-model="vModel"
    :placeholder="placeholder"
    :is-focus-on-mounted="!isExpandedFormOpen && !isEditColumn && !isForm"
    :style="{
      ...(!isForm && !isExpandedFormOpen && { 'margin-top': '1px' }),
      ...((isForm || isExpandedFormOpen) && { width: '100%' }),
    }"
    :disabled="readOnly"
    :precision="precision"
    @blur="editEnabled = false"
  />
</template>
