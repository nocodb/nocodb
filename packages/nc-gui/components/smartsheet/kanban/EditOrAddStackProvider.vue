<script lang="ts" setup>
// todo: Remove this "Provider" component and use the "EditOrAdd" component directly
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'

interface Props {
  column?: ColumnType
  optionId?: string
  isNew?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel', 'mounted'])

const meta = inject(MetaInj, ref())

const { column } = toRefs(props)

useProvideColumnCreateStore(meta, column, undefined, undefined, undefined, ref(true))
</script>

<template>
  <SmartsheetKanbanEditOrAddStack
    :option-id="optionId"
    :is-new="isNew"
    @submit="emit('submit')"
    @cancel="emit('cancel')"
    @mounted="emit('mounted')"
  />
</template>
