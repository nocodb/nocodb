<script setup lang="ts">
const { isCompact, updateCompact } = useKanbanViewStore()

const { t } = useI18n()
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      <span class="capitalize">{{ isCompact ? t('tooltip.kanbanExpandCards') : t('tooltip.kanbanCompactCards') }}</span>
    </template>
    <NcButton
      v-e="['c:toolbar:kanban-compact-mode']"
      size="small"
      type="text"
      :class="{ 'nc-active-btn': isCompact }"
      @click="updateCompact(!isCompact)"
    >
      <GeneralIcon
        :icon="isCompact ? 'rowHeight' : 'rowHeight'"
        class="h-4 w-4"
      />
    </NcButton>
  </NcTooltip>
</template>
