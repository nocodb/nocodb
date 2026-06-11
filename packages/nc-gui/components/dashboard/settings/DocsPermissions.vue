<script setup lang="ts">
interface Props {
  state: string
  baseId: string
}

defineProps<Props>()

defineEmits(['update:state'])
</script>

<template>
  <NcSpanHidden />
</template>
