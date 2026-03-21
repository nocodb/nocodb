<script lang="ts" setup>
const { isCompact, toggleCompact } = useKanbanViewStore()
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      {{ isCompact ? $t('tooltip.kanbanExpandCards') : $t('tooltip.kanbanCompactCards') }}
    </template>

    <NcButton
      v-e="['c:kanban:compact-mode']"
      type="text"
      size="small"
      class="nc-toolbar-btn nc-kanban-compact-mode-btn !h-7 !px-2"
      :class="{ 'nc-active-btn': isCompact }"
      @click="toggleCompact"
    >
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="rowHeight" class="h-4 w-4" />
        <span class="text-xs font-medium">{{ $t('title.compactMode') }}</span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
