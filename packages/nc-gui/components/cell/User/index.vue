<script lang="ts" setup>
import type { SelectOptionType } from 'nocodb-sdk'
import { getOptions } from './utils'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
  showReadonlyField?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const active = inject(ActiveCellInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const { basesUser } = storeToRefs(useBases())

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const options = computed<(SelectOptionType & { value?: string })[]>(() => {
  return getOptions(column.value, isEditColumn.value, isForm.value, baseUsers.value)
})

const showReadonlyField = computed(() => {
  return props.showReadonlyField ?? (readOnly.value || !(active.value || isEditColumn.value || isForm.value))
})
</script>

<template>
  <LazyCellUserReadonly v-if="showReadonlyField" :model-value="vModel" :row-index="rowIndex" :options="options" />
  <LazyCellUserEditor v-else v-model="vModel" :row-index="rowIndex" :options="options" />
</template>
