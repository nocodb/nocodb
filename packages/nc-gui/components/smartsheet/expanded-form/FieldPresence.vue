<script setup lang="ts">
/** CE placeholder — per-field presence is EE-only. */
interface Props {
  columnId?: string
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
