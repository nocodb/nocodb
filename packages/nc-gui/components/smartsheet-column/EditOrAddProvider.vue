<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { MetaInj, inject } from '#imports'

interface Props {
  column?: Ref<ColumnType & { meta: any }>
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel'])

const meta = inject(MetaInj, ref())

const column = toRef(props, 'column')
useProvideColumnCreateStore(meta, column as Ref<ColumnType | undefined>)
</script>

<template>
  <SmartsheetColumnEditOrAdd @submit="emit('submit')" @cancel="emit('cancel')"></SmartsheetColumnEditOrAdd>
</template>
