<script lang="ts" setup>
interface Props {
  visible: boolean
  baseId: string
  tableId: string
}

defineProps<Props>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
