<script setup lang="ts">
// This component is not used directly. Cell.vue uses CellColourEditor and CellColourReadonly.
// Kept as a minimal wrapper for Nuxt auto-import resolution.
interface Props {
  modelValue: string | null | undefined
}

defineProps<Props>()
</script>

<template>
  <CellColourEditor :model-value="modelValue" />
</template>
