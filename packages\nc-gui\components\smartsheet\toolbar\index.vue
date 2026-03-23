<script lang="ts" setup>
import { storeToRefs } from 'pinia'

const { isKanban, isGallery, isCalendar, isMap, isGrid } = useViewStates()

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { activeView } = storeToRefs(useViewsStore())

const isSqlView = computed(() => activeView.value?.type === 'table' && (activeView.value as any)?.isSqlView)
</script>

<template>
  <div
    class="nc-toolbar-container flex items-center gap-x-2 px-3 py-2 border-b-1 border-gray-200 dark:border-gray-700 overflow-x-auto nc-scrollbar-x-md"
  >
    <div class="flex-1 flex items-center gap-x-1.5 overflow-hidden">
      <LazySmartsheetToolbarFieldsMenu
        v-if="isUIAllowed('viewFieldEdit')"
        :show-icon="true"
      />

      <LazySmartsheetToolbarColumnFilter v-if="isUIAllowed('viewFilterEdit')" />

      <LazySmartsheetToolbarGroupBy v-if="!isKanban && !isGallery" />

      <LazySmartsheetToolbarSortListMenu v-if="isUIAllowed('viewSortEdit')" />

      <LazySmartsheetToolbarSearchData v-if="isGrid" />
    </div>

    <div class="flex items-center gap-x-1.5 flex-shrink-0">
      <!-- Kanban compact mode toggle -->
      <LazySmartsheetToolbarKanbanCompactMode v-if="isKanban" />

      <LazySmartsheetToolbarReload />

      <LazySmartsheetToolbarAddRow
        v-if="isUIAllowed('dataInsert') && !isSqlView && !isCalendar && !isMap"
      />
    </div>
  </div>
</template>
