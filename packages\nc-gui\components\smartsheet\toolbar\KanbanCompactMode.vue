<script lang="ts" setup>
const { isCompact, toggleCompact } = useKanbanViewStore()
</script>

<template>
  <NcTooltip>
    <template #title>{{ isCompact ? $t('tooltip.kanbanExpandCards') : $t('tooltip.kanbanCompactCards') }}</template>
    <NcButton
      v-e="['c:toolbar:kanban-compact']"
      size="small"
      type="text"
      :class="{ 'text-brand-500 bg-brand-50': isCompact }"
      @click="toggleCompact"
    >
      <GeneralIcon icon="minimize2" class="h-4 w-4" />
    </NcButton>
  </NcTooltip>
</template>
