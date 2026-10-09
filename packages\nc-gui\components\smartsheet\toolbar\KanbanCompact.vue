<script setup lang="ts">
const { isCompact, updateCompact } = useKanbanViewStore()
const { t } = useI18n()
</script>

<template>
  <NcTooltip>
    <template #title>
      {{ isCompact ? t('tooltip.kanbanNormalMode') : t('tooltip.kanbanCompactMode') }}
    </template>
    <NcButton
      v-e="['c:toolbar:kanban:compact-mode']"
      size="small"
      type="text"
      :class="{ 'nc-active-btn': isCompact }"
      @click="updateCompact(!isCompact)"
    >
      <MdiViewHeadline v-if="!isCompact" class="h-4 w-4" />
      <MdiViewStream v-else class="h-4 w-4" />
    </NcButton>
  </NcTooltip>
</template>
