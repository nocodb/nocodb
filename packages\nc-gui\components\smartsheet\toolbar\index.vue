<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'

const { isKanban, isSqlView, isGallery } = useViewStates()

const { activeView } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()
</script>

<template>
  <div
    class="nc-toolbar-container flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 overflow-x-auto nc-scrollbar-thin"
  >
    <!-- Left side toolbar items -->
    <div class="flex items-center gap-1.5 flex-1 overflow-hidden">
      <LazySmartsheetToolbarSearchData />

      <template v-if="!isMobileMode">
        <LazySmartsheetToolbarFieldsMenu v-if="isUIAllowed('viewFieldEdit')" />
        <LazySmartsheetToolbarColumnFilter v-if="isUIAllowed('viewFilterEdit')" />
        <LazySmartsheetToolbarGroupBy v-if="!isKanban" />
        <LazySmartsheetToolbarSortListMenu v-if="isUIAllowed('viewSortEdit')" />
      </template>
    </div>

    <!-- Right side toolbar items -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <!-- Kanban-specific toolbar items -->
      <template v-if="isKanban">
        <LazySmartsheetToolbarKanbanCompactMode />
      </template>

      <LazySmartsheetToolbarReload v-if="isUIAllowed('dataInsert')" />

      <template v-if="!isMobileMode && !isSqlView">
        <LazySmartsheetToolbarAddRow v-if="isUIAllowed('dataInsert')" />
      </template>
    </div>
  </div>
</template>
