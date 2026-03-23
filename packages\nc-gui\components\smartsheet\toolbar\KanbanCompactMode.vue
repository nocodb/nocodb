<script lang="ts" setup>
const { isCompactMode, toggleCompactMode } = useKanbanViewStoreOrThrow()

const { $e } = useNuxtApp()

const { t } = useI18n()

async function handleToggle() {
  try {
    await toggleCompactMode()
    $e('a:kanban:compact-mode-toggle', { compact: isCompactMode.value })
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>
      {{
        isCompactMode
          ? t('tooltip.kanbanDisableCompactMode')
          : t('tooltip.kanbanEnableCompactMode')
      }}
    </template>

    <NcButton
      v-e="['c:kanban:compact-mode']"
      size="small"
      :type="isCompactMode ? 'secondary' : 'text'"
      :class="{
        '!text-brand-500 !bg-brand-50 hover:!bg-brand-100': isCompactMode,
        '!text-gray-600': !isCompactMode,
      }"
      @click="handleToggle"
    >
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="rows01" class="h-3.5 w-3.5" />
        <span class="text-xs font-medium leading-4">
          {{ t('activity.kanbanCompactMode') }}
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
