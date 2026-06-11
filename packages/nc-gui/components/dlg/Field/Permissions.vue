<script lang="ts" setup>
defineProps<{
  visible: boolean
  fieldId: string
  fieldTitle: string
  fieldUidt: string
}>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
