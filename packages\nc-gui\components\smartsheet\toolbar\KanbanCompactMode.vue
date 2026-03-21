<script lang="ts" setup>
const { isCompact, toggleCompact } = useKanbanViewStore()
</script>

<template>
  <NcTooltip>
    <template #title>
      {{ isCompact ? $t('activity.expandCards') : $t('activity.compactCards') }}
    </template>
    <NcButton
      v-e="['c:kanban:toggle-compact']"
      size="small"
      type="text"
      class="nc-kanban-compact-mode-btn !h-7 !px-2 !rounded-md"
      :class="{ 'bg-gray-100 dark:bg-gray-800': isCompact }"
      @click="toggleCompact"
    >
      <div class="flex items-center gap-1">
        <component
          :is="iconMap.list"
          v-if="isCompact"
          class="h-4 w-4"
        />
        <component
          :is="iconMap.expand"
          v-else
          class="h-4 w-4"
        />
        <span class="text-xs hidden md:inline">
          {{ isCompact ? $t('activity.defaultView') : $t('activity.compactView') }}
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
