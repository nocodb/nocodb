<script setup lang="ts">
const { isCompact, updateCompact } = useKanbanViewStore()
</script>

<template>
  <NcTooltip>
    <template #title>
      {{ isCompact ? $t('tooltip.kanbanNormalView') : $t('tooltip.kanbanCompactView') }}
    </template>
    <NcButton
      v-e="['c:toolbar:kanban-compact-mode']"
      size="small"
      type="text"
      class="nc-kanban-compact-btn"
      :class="{ 'nc-active-btn': isCompact }"
      @click="updateCompact(!isCompact)"
    >
      <component :is="iconMap.minimize2" class="h-4 w-4" />
    </NcButton>
  </NcTooltip>
</template>
