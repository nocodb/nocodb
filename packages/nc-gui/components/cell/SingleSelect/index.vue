<script lang="ts" setup>
import type { SelectOptionType } from 'nocodb-sdk'
import { getOptions } from './utils'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
  disableOptionCreation?: boolean
  showReadonlyField?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const column = inject(ColumnInj)!

const active = inject(ActiveCellInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const options = computed<(SelectOptionType & { value?: string })[]>(() => {
  return getOptions(column.value, isEditColumn.value, isForm.value)
})

const showReadonlyField = computed(() => {
  return props.showReadonlyField ?? (readOnly.value || !(active.value || isEditColumn.value || isForm.value))
})
</script>

<template>
  <LazyCellSingleSelectReadonly v-if="showReadonlyField" :model-value="vModel" :row-index="rowIndex" :options="options" />
  <LazyCellSingleSelectEditor
    v-else
    v-model="vModel"
    :disable-option-creation="disableOptionCreation"
    :row-index="rowIndex"
    :options="options"
  />
</template>
