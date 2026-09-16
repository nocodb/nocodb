<script setup lang="ts">
import { useKanbanViewStoreOrThrow } from '#imports'

const { isCompactMode } = useKanbanViewStoreOrThrow()
</script>

<template>
  <NcTooltip>
    <template #title>
      {{ isCompactMode ? $t('tooltip.kanban.disableCompactMode') : $t('tooltip.kanban.enableCompactMode') }}
    </template>
    <NcButton
      v-e="['c:kanban:compact-mode']"
      size="small"
      type="text"
      :class="{ 'text-brand-500': isCompactMode }"
      @click="isCompactMode = !isCompactMode"
    >
      <GeneralIcon icon="rows01" class="h-4 w-4" />
    </NcButton>
  </NcTooltip>
</template>
