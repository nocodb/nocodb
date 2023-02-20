<script lang="ts" setup>
// todo: Remove this "Provider" component and use the "EditOrAdd" component directly
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'
import { MetaInj, inject, ref, toRef, useProvideColumnCreateStore } from '#imports'

interface Props {
  column?: ColumnType
  columnPosition?: Pick<ColumnReqType, 'column_order'>
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel'])

const meta = inject(MetaInj, ref())

const column = toRef(props, 'column')

useProvideColumnCreateStore(meta, column)
</script>

<template>
  <SmartsheetColumnEditOrAdd :column-position="props.columnPosition" @submit="emit('submit')" @cancel="emit('cancel')" />
</template>
