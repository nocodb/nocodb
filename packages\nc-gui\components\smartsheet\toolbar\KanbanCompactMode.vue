<script lang="ts" setup>
const { isCompactMode, toggleCompactMode } = useKanbanViewStoreOrThrow()

const { $e } = useNuxtApp()

async function onClick() {
  await toggleCompactMode()
  $e('a:kanban:compact-mode', { compact: isCompactMode.value })
}
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      <span>{{ isCompactMode ? $t('activity.kanban.disableCompactMode') : $t('activity.kanban.enableCompactMode') }}</span>
    </template>

    <NcButton
      v-e="['c:kanban:toggle-compact-mode']"
      :type="isCompactMode ? 'secondary' : 'text'"
      size="small"
      :class="{
        'text-brand-500 bg-brand-50 !border-brand-200': isCompactMode,
      }"
      @click="onClick"
    >
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="compact" class="h-4 w-4" />
        <span class="text-xs font-medium">{{ $t('activity.kanban.compactMode') }}</span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
