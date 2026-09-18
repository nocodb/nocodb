<script lang="ts" setup>
// Icon-only "Tools" toolbar entry: opens the table Tools shell modal
// (components/smartsheet/Details.vue) directly; the shell's rail is the menu.

const { isUIAllowed } = useRoles()

const { onViewsTabChange } = useViewsStore()

const { openedViewsTab } = storeToRefs(useViewsStore())

const { isSqlView } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

// Hidden on public/shared views (no schema editing) and on mobile, matching the
// old Data | Details toggle's gating. Mounted across the grid/gallery/kanban/
// calendar/list toolbar plus the timeline/gantt toolbars, so the gate lives here.
const isVisible = computed(() => !isPublic.value && !isSharedBase.value && !isMobileMode.value)

const isShellOpen = computed(() => openedViewsTab.value !== 'view')

// Land on Manage fields when the user may edit schema; Relations is always reachable.
const defaultTool = computed(() => (isUIAllowed('fieldAdd') && !isSqlView.value ? 'field' : 'relation'))

const openTools = () => {
  onViewsTabChange(defaultTool.value)
}
</script>

<template>
  <NcTooltip v-if="isVisible" :title="$t('general.tools')" placement="bottom">
    <NcButton
      v-e="['c:table:tools']"
      class="nc-table-tools-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
      size="small"
      type="text"
      data-testid="nc-table-tools-btn"
      :class="{ '!bg-nc-bg-gray-medium': isShellOpen }"
      @click="openTools"
    >
      <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />
    </NcButton>
  </NcTooltip>
</template>
