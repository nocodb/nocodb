<script lang="ts" setup>
/**
 * CE stub — base-level sections are EE-only. The real implementation lives at
 * ee/components/dashboard/TreeView/Data/MoveToSectionMenu.vue and shadows this
 * in EE builds. Same props so CE call-sites typecheck.
 */
interface Props {
  entityId: string
  entityType: 'table' | 'dashboard' | 'document'
  baseId: string
  currentSectionId?: string | null
  order?: number
}

defineProps<Props>()

defineEmits(['closeModal'])
</script>

<template>
  <NcSpanHidden />
</template>
