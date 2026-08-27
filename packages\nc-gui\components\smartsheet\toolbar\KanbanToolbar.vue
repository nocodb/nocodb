<script lang="ts" setup>
import { useKanbanViewStoreOrThrow } from '#imports'

const { kanbanMetaData, updateKanbanMeta } = useKanbanViewStoreOrThrow()

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

async function toggleCompactMode() {
  await updateKanbanMeta({
    compact_mode: !isCompactMode.value,
  })
}
</script>

<template>
  <NcTooltip>
    <template #title>{{ isCompactMode ? $t('tooltip.expandCards') : $t('tooltip.compactCards') }}</template>
    <NcButton
      size="small"
      type="text"
      :class="{ 'text-brand-500': isCompactMode }"
      @click="toggleCompactMode"
    >
      <component :is="iconMap.list" class="h-4 w-4" />
    </NcButton>
  </NcTooltip>
</template>
