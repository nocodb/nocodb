<script lang="ts" setup>
const { isCompactMode, toggleCompactMode } = useKanbanViewStore()!

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2 nc-kanban-toolbar-extra">
    <NcTooltip>
      <template #title>
        {{ isCompactMode ? t('tooltip.kanbanDisableCompact') : t('tooltip.kanbanEnableCompact') }}
      </template>
      <NcButton
        v-e="['c:kanban:compact-mode-toggle']"
        :type="isCompactMode ? 'primary' : 'secondary'"
        size="xs"
        class="nc-kanban-compact-btn"
        @click="toggleCompactMode"
      >
        <div class="flex items-center gap-1">
          <GeneralIcon icon="list" class="h-3.5 w-3.5" />
          <span class="text-xs font-medium">{{ t('general.compact') }}</span>
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>
