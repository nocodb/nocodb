<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { inject } from '#imports'
import { MetaInj } from '~/context'

interface Props {
  column?: Ref<ColumnType & { meta: any }>
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel'])

const meta = inject(MetaInj)

if (props?.column) {
  const column = toRef(props, 'column')
  useProvideColumnCreateStore(meta as Ref<TableType>, column)
} else {
  useProvideColumnCreateStore(meta as Ref<TableType>)
}
</script>

<template>
  <SmartsheetColumnEditOrAdd @submit="emit('submit')" @cancel="emit('cancel')"></SmartsheetColumnEditOrAdd>
</template>
