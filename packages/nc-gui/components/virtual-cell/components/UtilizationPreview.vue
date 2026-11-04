<script setup lang="ts">
import type { LinkUtilizationPreviewValue } from 'nocodb-sdk'

// CE stub — link utilization preview is EE-only. The EE overlay
// (ee/components/virtual-cell/components/UtilizationPreview.vue) renders it.
defineProps<{ value?: LinkUtilizationPreviewValue | null; variant?: 'stacked' | 'inline' }>()
</script>

<template>
  <NcSpanHidden />
</template>
