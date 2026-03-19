<script lang="ts" setup>
const { kanbanMetaData, updateKanbanMeta } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

async function toggleCompactMode() {
  await updateKanbanMeta({
    compact_mode: !isCompactMode.value,
  } as any)
}
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      <span>{{ isCompactMode ? $t('tooltip.expandCardView') : $t('tooltip.compactCardView') }}</span>
    </template>
    <NcButton
      v-e="['c:kanban:compact-mode']"
      :class="{
        '!text-brand-500 !bg-brand-50': isCompactMode,
      }"
      class="nc-kanban-compact-mode nc-toolbar-btn"
      size="small"
      type="text"
      @click="toggleCompactMode"
    >
      <div class="flex items-center gap-2">
        <GeneralIcon icon="ncList" class="h-4 w-4" />
        <span v-if="!isMobileMode" class="text-[13px] font-medium">
          {{ $t('title.compact') }}
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
