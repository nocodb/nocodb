<script lang="ts" setup>
import { CellClickHookInj, createEventHook, onBeforeUnmount, onMounted, ref, useSmartsheetStoreOrThrow } from '#imports'

const { cellRefs } = useSmartsheetStoreOrThrow()

const el = ref<HTMLTableDataCellElement>()

const cellClickHook = createEventHook()

provide(CellClickHookInj, cellClickHook)

onMounted(() => {
  cellRefs.value.push(el.value!)
})

onBeforeUnmount(() => {
  const index = cellRefs.value.indexOf(el.value!)
  if (index > -1) {
    cellRefs.value.splice(index, 1)
  }
})
</script>

<template>
  <td ref="el" @click="cellClickHook.trigger($event)">
    <slot />
  </td>
</template>
