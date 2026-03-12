<script lang="ts" setup>
// PR review fix #10: Editor delegates to Readonly since UUID is always read-only
interface Props {
  modelValue?: string | null
}

defineProps<Props>()
</script>

<template>
  <!-- UUID is read-only; editor renders the same as readonly -->
  <CellUUIDReadonly :model-value="modelValue" />
</template>
