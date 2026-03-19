<script lang="ts" setup>
import { useKanbanViewStoreOrThrow } from '#imports'

const { kanbanMetaData, updateKanbanMeta } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

const canEdit = computed(() => isUIAllowed('dataEdit'))

async function toggleCompactMode() {
  if (!canEdit.value) return
  await updateKanbanMeta({
    ...(kanbanMetaData.value ?? {}),
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
      v-e="['c:kanban:compact-mode']"
      size="small"
      type="text"
      :disabled="!canEdit"
      :class="{
        'nc-active-btn': isCompactMode,
      }"
      class="nc-kanban-compact-mode-toggle"
      @click="toggleCompactMode"
    >
      <div class="flex items-center gap-2">
        <GeneralIcon icon="list" class="h-4 w-4" />
        <span class="text-sm">{{ $t('title.compact') }}</span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
