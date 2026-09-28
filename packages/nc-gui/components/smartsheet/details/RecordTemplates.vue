<script setup lang="ts">
// CE stub — Record Templates is an EE-only feature. The full implementation
// lives in ee/components/smartsheet/details/RecordTemplates.vue. This stub keeps
// the component resolvable in CE builds, where it never renders.
defineProps<{
  inShell?: boolean
}>()

// Match the EE component's exposed surface so parent refs don't break in CE.
defineExpose({ openTemplateForm: () => {} })
</script>

<template>
  <NcSpanHidden />
</template>
