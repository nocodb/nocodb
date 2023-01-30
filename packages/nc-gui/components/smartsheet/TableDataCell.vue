<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, useSmartsheetStoreOrThrow } from '#imports'

const { cellRefs } = useSmartsheetStoreOrThrow()

const el = ref<HTMLTableDataCellElement>()

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
  <td ref="el">
    <slot />
  </td>
</template>
