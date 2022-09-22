<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { MetaInj, inject, ref, toRef, useProvideColumnCreateStore } from '#imports'

interface Props {
  column?: ColumnType & { meta: any }
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel'])

const meta = inject(MetaInj, ref())

const column = toRef(props, 'column')

useProvideColumnCreateStore(meta, column)
</script>

<template>
  <LazySmartsheetColumnEditOrAdd @submit="emit('submit')" @cancel="emit('cancel')" />
</template>
