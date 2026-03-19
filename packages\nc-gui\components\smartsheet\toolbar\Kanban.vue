<script setup lang="ts">
const { isCompactMode, toggleCompactMode } = useKanbanViewStore()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2">
    <NcTooltip :title="isCompactMode ? t('tooltip.disableCompactMode') : t('tooltip.enableCompactMode')">
      <NcButton
        v-e="['c:kanban:compact-mode']"
        :type="isCompactMode ? 'primary' : 'text'"
        size="small"
        class="nc-kanban-compact-mode-btn"
        @click="toggleCompactMode"
      >
        <div class="flex items-center gap-1">
          <GeneralIcon icon="rows" class="h-4 w-4" />
          <span class="text-xs">{{ t('general.compact') }}</span>
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>
