<script lang="ts" setup>
const { kanbanMetaData, updateKanbanMeta } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

async function toggleCompactMode() {
  if (!isUIAllowed('dataEdit')) return
  await updateKanbanMeta({
    compact_mode: !isCompactMode.value,
  })
}
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      {{ isCompactMode ? $t('tooltip.expandCardView') : $t('tooltip.compactCardView') }}
    </template>
    <NcButton
      v-e="['c:kanban:toggle-compact']"
      size="small"
      type="text"
      :class="{ 'text-brand-500 !bg-brand-50': isCompactMode }"
      class="nc-toolbar-btn"
      @click="toggleCompactMode"
    >
      <div class="flex items-center gap-2">
        <component :is="iconMap.compact" class="h-4 w-4" />
        <span v-if="!isMobileMode" class="text-sm font-medium">
          {{ $t('title.compact') }}
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
