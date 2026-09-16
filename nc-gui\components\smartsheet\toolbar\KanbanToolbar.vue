<script setup lang="ts">
import { useKanbanViewStoreOrThrow, useSmartsheetStoreOrThrow } from '#imports'

const { isCompactMode, toggleCompactMode } = useKanbanViewStoreOrThrow()
const { isMobileMode } = useSmartsheetStoreOrThrow()
</script>

<template>
  <div class="nc-kanban-toolbar flex items-center gap-2">
    <!-- ... existing toolbar items ... -->

    <!-- Compact Mode Toggle -->
    <NcTooltip placement="bottom">
      <template #title>
        {{ isCompactMode ? $t('tooltip.kanban.normalView') : $t('tooltip.kanban.compactView') }}
      </template>
      <NcButton
        v-if="!isMobileMode"
        :class="{ 'nc-active-btn': isCompactMode }"
        class="nc-kanban-compact-btn"
        size="small"
        type="text"
        @click="toggleCompactMode"
      >
        <div class="flex items-center gap-1">
          <component
            :is="isCompactMode ? 'NcIconCardViewNormal' : 'NcIconCardViewCompact'"
            class="h-4 w-4"
          />
          <span v-if="!isMobileMode" class="text-sm capitalize">
            {{ isCompactMode ? $t('labels.normalView') : $t('labels.compactView') }}
          </span>
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>
