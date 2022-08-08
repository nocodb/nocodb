<script lang="ts" setup>
import type { Row } from '~/composables'
import { useSmartsheetStoreOrThrow } from '~/composables'
import { useProvideSmartsheetRowStore } from '~/composables/useSmartsheetRowStore'

interface Props {
  row: Row
}

const props = defineProps<Props>()
const emit = defineEmits(['expandForm', 'selectCell', 'updateOrSaveRow', 'navigate'])
const row = toRef(props, 'row')

const { meta } = useSmartsheetStoreOrThrow()
const { isNew, state, syncLTARRefs } = useProvideSmartsheetRowStore(meta, row)

// on changing isNew(new record insert) status sync LTAR cell values
watch(isNew, async (nextVal, prevVal) => {
  if (prevVal && !nextVal) {
    await syncLTARRefs(row.value.row)
    // update row values without invoking api
    row.value.row = { ...row.value.row, ...state.value }
    row.value.oldRow = { ...row.value.row, ...state.value }
  }
})
</script>

<template>
  <slot :state="state" />
</template>
