<script lang="ts" setup>
import { useKanbanViewStore } from '#imports'

const { isCompact, toggleCompact } = useKanbanViewStore()
</script>

<template>
  <NcTooltip>
    <template #title>
      {{ isCompact ? $t('tooltip.expandCards') : $t('tooltip.compactCards') }}
    </template>
    <NcButton
      v-e="['c:kanban:compact-mode']"
      size="small"
      type="text"
      class="nc-kanban-compact-btn !h-7 !w-7"
      :class="{ 'active': isCompact }"
      @click="toggleCompact"
    >
      <GeneralIcon :icon="isCompact ? 'expand' : 'compact'" class="h-4 w-4" />
    </NcButton>
  </NcTooltip>
</template>
