<script lang="ts" setup>
const { kanbanMetaData, updateKanbanMeta } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

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
      <span>{{ isCompactMode ? $t('tooltip.expandCardView') : $t('tooltip.compactCardView') }}</span>
    </template>
    <NcButton
      v-e="['c:kanban:toggle-compact-mode']"
      class="nc-kanban-compact-mode-btn nc-toolbar-btn"
      size="small"
      type="text"
      :class="{
        '!text-brand-500 !bg-brand-50 !border-brand-200': isCompactMode,
      }"
      @click="toggleCompactMode"
    >
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="ncAlignJustify" class="h-4 w-4" />
        <span v-if="!isMobileMode" class="font-medium text-[13px]">
          {{ $t('title.compact') }}
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
