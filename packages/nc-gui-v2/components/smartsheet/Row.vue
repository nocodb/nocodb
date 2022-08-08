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
const { isNew, localState } = useProvideSmartsheetRowStore(meta, row)
watch(row, () => {
  localState.value = {}
})
</script>

<template>
  <slot />
</template>
