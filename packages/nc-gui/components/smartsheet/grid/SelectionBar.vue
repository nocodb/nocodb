<script setup lang="ts">
// The checked-rows bar is EE (ee/components/smartsheet/grid/SelectionBar.vue).
interface Props {
  count: number
}

defineProps<Props>()

defineEmits<{
  clear: []
}>()
</script>

<template>
  <NcSpanHidden />
</template>
