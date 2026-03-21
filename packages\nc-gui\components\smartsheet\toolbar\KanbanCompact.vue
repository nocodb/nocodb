<script setup lang="ts">
const { isCompact, updateCompact } = useKanbanViewStore()
const { t } = useI18n()
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      {{ isCompact ? t('tooltip.kanbanExpandCards') : t('tooltip.kanbanCompactCards') }}
    </template>
    <NcButton
      v-e="['c:toolbar:kanban-compact']"
      size="small"
      type="text"
      class="nc-kanban-compact-btn"
      :class="{ 'nc-active-btn': isCompact }"
      @click="updateCompact(!isCompact)"
    >
      <GeneralIcon
        :icon="isCompact ? 'maximize2' : 'minimize2'"
        class="h-4 w-4"
      />
    </NcButton>
  </NcTooltip>
</template>
