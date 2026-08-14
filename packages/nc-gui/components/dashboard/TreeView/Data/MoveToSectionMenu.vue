<script lang="ts" setup>
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
