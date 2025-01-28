<script lang="ts" setup>
import type { SelectOptionType } from 'nocodb-sdk'
import { getOptions } from './utils'

interface Props {
  modelValue?: string | string[]
  rowIndex?: number
  disableOptionCreation?: boolean
  location?: 'cell' | 'filter'
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
  <LazyCellMultiSelectReadonly
    v-if="showReadonlyField"
    :model-value="vModel"
    :row-index="rowIndex"
    :options="options"
    :location="location"
  />
  <LazyCellMultiSelectEditor
    v-else
    v-model="vModel"
    :disable-option-creation="disableOptionCreation"
    :row-index="rowIndex"
    :options="options"
    :location="location"
  />
</template>
