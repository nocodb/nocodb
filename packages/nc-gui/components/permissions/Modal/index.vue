<script lang="ts" setup>
interface Props {
  visible: boolean
  baseId: string
  tableId: string
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
