<script lang="ts" setup>
const { isCompact, toggleCompact } = useKanbanViewStore()

const { isMobileMode } = useGlobal()
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      <span>{{ isCompact ? $t('activity.kanban.expandCards') : $t('activity.kanban.compactCards') }}</span>
    </template>
    <NcButton
      v-e="['c:kanban:compact-mode-toggle']"
      size="small"
      type="text"
      class="nc-toolbar-btn nc-kanban-compact-mode-btn !h-7 !px-1.5 !rounded"
      :class="{ '!bg-gray-100 dark:!bg-gray-800 !text-primary': isCompact }"
      @click="toggleCompact"
    >
      <div class="flex items-center gap-1.5">
        <GeneralIcon
          :icon="isCompact ? 'kanbanCollapse' : 'kanbanExpand'"
          class="h-4 w-4"
        />
        <span v-if="!isMobileMode" class="text-xs font-medium">
          {{ $t('activity.kanban.compactMode') }}
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
