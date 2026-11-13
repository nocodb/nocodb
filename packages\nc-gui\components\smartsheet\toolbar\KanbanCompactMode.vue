<script lang="ts" setup>
const { isCompactMode, toggleCompactMode } = useKanbanViewStoreOrThrow()
const { $e } = useNuxtApp()

async function onClick() {
  await toggleCompactMode()
  $e('a:kanban:compact-mode', { enabled: isCompactMode.value })
}
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      {{ isCompactMode ? $t('tooltip.kanbanCompactModeDisable') : $t('tooltip.kanbanCompactModeEnable') }}
    </template>
    <NcButton
      v-e="['c:kanban:compact-mode']"
      size="small"
      :type="isCompactMode ? 'secondary' : 'text'"
      :class="[
        isCompactMode
          ? 'nc-active-btn !text-brand-500'
          : 'nc-toolbar-btn',
      ]"
      @click="onClick"
    >
      <div class="flex items-center gap-1">
        <component :is="iconMap.rowHeight" class="h-4 w-4" />
        <span class="nc-toolbar-btn-txt hidden md:inline">{{ $t('activity.kanbanCompactMode') }}</span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
