<script lang="ts" setup>
import { useKanbanViewStore } from '#imports'

const { kanbanMetaData, updateKanbanMeta } = useKanbanViewStore()

const isCompact = computed({
  get: () => !!(kanbanMetaData.value as any)?.meta?.compact,
  set: async (val: boolean) => {
    await updateKanbanMeta({
      meta: {
        ...(kanbanMetaData.value as any)?.meta,
        compact: val,
      },
    })
  },
})
</script>

<template>
  <NcTooltip>
    <template #title>
      {{ isCompact ? $t('activity.expandKanbanCards') : $t('activity.compactKanbanCards') }}
    </template>
    <NcButton
      v-e="['c:kanban:compact-mode']"
      size="small"
      type="text"
      :class="{ 'text-primary bg-primary bg-opacity-10': isCompact }"
      @click="isCompact = !isCompact"
    >
      <GeneralIcon icon="rowHeight" />
    </NcButton>
  </NcTooltip>
</template>
