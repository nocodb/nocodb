<script setup lang="ts">
interface Props {
  state: string
  baseId: string
  reload?: boolean
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
