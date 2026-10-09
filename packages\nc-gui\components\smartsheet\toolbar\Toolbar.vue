<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'

const { isMobileMode } = useGlobal()
const view = inject(ActiveViewInj, ref())
const meta = inject(MetaInj, ref())

const isKanban = computed(() => view.value?.type === ViewTypes.KANBAN)
const isGallery = computed(() => view.value?.type === ViewTypes.GALLERY)
const isGrid = computed(() => view.value?.type === ViewTypes.GRID)
const isForm = computed(() => view.value?.type === ViewTypes.FORM)
const isCalendar = computed(() => view.value?.type === ViewTypes.CALENDAR)

const { isCompact, toggleCompact } = isKanban.value ? useKanbanViewStore() : { isCompact: ref(false), toggleCompact: () => {} }
</script>

<template>
  <div
    class="nc-toolbar-wrapper flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-3 py-1.5"
  >
    <!-- Left section: View controls -->
    <div class="flex items-center gap-2 flex-1 overflow-hidden">
      <LazySmartsheetToolbarFieldsMenu :show-system-fields="false" />
      <LazySmartsheetToolbarColumnFilterMenu />
      <LazySmartsheetToolbarGroupByMenu v-if="!isForm && !isCalendar" />
      <LazySmartsheetToolbarSortListMenu />
      <LazySmartsheetToolbarSearchData v-if="isGrid" />
    </div>

    <!-- Right section: View-specific controls -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- Kanban compact mode toggle -->
      <LazySmartsheetToolbarKanbanCompactMode v-if="isKanban" />

      <!-- Other controls -->
      <LazySmartsheetToolbarReloadViewData />
    </div>
  </div>
</template>
