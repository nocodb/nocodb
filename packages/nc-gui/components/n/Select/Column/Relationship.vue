<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { NSelectColumnProps } from './types'

const props = withDefaults(defineProps<NSelectColumnProps>(), {
  placeholder: '-select a link field-',
})

const modelValue = useVModel(props, 'modelValue')

const filterColumns = (c: ColumnType) => {
  const l1Filter = c.uidt === 'Links' || c.uidt === 'LinkToAnotherRecord'
  let l2Filter = true
  if (props.filterColumns) {
    l2Filter = props.filterColumns(c)
  }
  return l1Filter && l2Filter
}
</script>

<template>
  <NSelectColumn v-bind="props" v-model="modelValue" />
</template>
