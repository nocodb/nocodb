<script lang="ts" setup>
const { isCompact, toggleCompact } = useKanbanViewStore()
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title>
      {{ isCompact ? $t('tooltip.kanbanExpandCards') : $t('tooltip.kanbanCompactCards') }}
    </template>

    <NcButton
      v-e="['c:kanban:compact-mode']"
      type="text"
      size="small"
      class="nc-toolbar-btn !h-7 !px-1.5 nc-kanban-compact-mode-btn"
      :class="{ '!bg-brand-50 !text-brand-500': isCompact }"
      @click="toggleCompact"
    >
      <div class="flex items-center gap-1">
        <MdiViewAgendaOutline v-if="isCompact" class="h-4 w-4" />
        <MdiViewDashboardOutline v-else class="h-4 w-4" />
        <span class="text-xs font-medium capitalize">
          {{ isCompact ? $t('activity.compactMode') : $t('activity.compactMode') }}
        </span>
      </div>
    </NcButton>
  </a-tooltip>
</template>
