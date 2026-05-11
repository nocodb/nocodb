<script setup lang="ts">
import type { BookmarkReqType } from 'nocodb-sdk'

const {
  addBookmark,
  isBookmarked,
  getBookmark,
  removeBookmark,
  isCreatingFolder,
  orderedGroups,
  collapsedGroupIds,
  expandAllGroups,
  collapseAllGroups,
} = useBookmarks()

const { $e } = useNuxtApp()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const tablesStore = useTablesStore()

const { activeTableId } = storeToRefs(tablesStore)

const viewsStore = useViewsStore()

const { activeView } = storeToRefs(viewsStore)

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const route = useRoute()

const isDropdownOpen = ref(false)

// --- Current page bookmark ---

// Route-derived IDs for in-base entities (docs/workflows/scripts/dashboards).
// Reading directly from route params mirrors how the EE stores derive these
// and avoids stale Pinia state when navigating between sibling routes.
const inBaseEntity = computed<{ targetType: string; targetId: string } | null>(() => {
  const params = route.params as Record<string, string | undefined>
  if (params.dashboardId) return { targetType: 'dashboard', targetId: params.dashboardId }
  if (params.docId) return { targetType: 'document', targetId: params.docId }
  if (params.workflowId) return { targetType: 'workflow', targetId: params.workflowId }
  if (params.scriptId) return { targetType: 'script', targetId: params.scriptId }
  return null
})

const currentPageBookmarkInfo = computed<{ targetType: string; targetId: string; meta: Record<string, any> } | null>(() => {
  const workspaceId = activeWorkspace.value?.id
  if (!workspaceId) return null

  const baseId = activeProjectId.value
  const tableId = activeTableId.value
  const viewId = activeView.value?.id

  // Most specific first: view → table → in-base entity → base
  if (viewId && tableId && baseId) {
    return {
      targetType: 'view',
      targetId: viewId,
      meta: { workspace_id: workspaceId, base_id: baseId, table_id: tableId, view_type: activeView.value?.type },
    }
  }

  if (tableId && baseId) {
    return {
      targetType: 'table',
      targetId: tableId,
      meta: { workspace_id: workspaceId, base_id: baseId },
    }
  }

  if (baseId && inBaseEntity.value) {
    return {
      targetType: inBaseEntity.value.targetType,
      targetId: inBaseEntity.value.targetId,
      meta: { workspace_id: workspaceId, base_id: baseId },
    }
  }

  if (baseId) {
    return {
      targetType: 'base',
      targetId: baseId,
      meta: { workspace_id: workspaceId },
    }
  }

  return null
})

const isCurrentPageBookmarked = computed(() => {
  const info = currentPageBookmarkInfo.value
  if (!info) return false
  return isBookmarked(info.targetType, info.targetId, info.meta)
})

async function toggleCurrentPageBookmark() {
  const info = currentPageBookmarkInfo.value
  if (!info) return

  isDropdownOpen.value = false

  if (isCurrentPageBookmarked.value) {
    const bm = getBookmark(info.targetType, info.targetId)
    if (bm) await removeBookmark(bm.id!)
  } else {
    await addBookmark({
      target_type: info.targetType,
      target_id: info.targetId,
      meta: info.meta,
    } as BookmarkReqType)
  }
}

// --- Dropdown actions ---

function onNewFolder() {
  isDropdownOpen.value = false
  isCreatingFolder.value = true
}

const hasGroups = computed(() => orderedGroups.value.length > 0)

// Disabled flags: nothing to collapse when every group is already collapsed,
// nothing to expand when none are collapsed.
const canCollapseAll = computed(() => {
  if (!orderedGroups.value.length) return false
  return orderedGroups.value.some((g) => !collapsedGroupIds.value.has(g.id!))
})

const canExpandAll = computed(() => collapsedGroupIds.value.size > 0)

function onCollapseAll() {
  isDropdownOpen.value = false
  collapseAllGroups()
  $e('a:bookmark:groups:collapse-all')
}

function onExpandAll() {
  isDropdownOpen.value = false
  expandAllGroups()
  $e('a:bookmark:groups:expand-all')
}
</script>

<template>
  <NcDropdown v-model:visible="isDropdownOpen" placement="bottomRight" overlay-class-name="nc-bookmark-add-dropdown">
    <NcButton type="text" size="small" class="!rounded-md" data-testid="nc-bookmark-add-btn" @click.stop>
      <GeneralIcon icon="ncMoreVertical" class="text-nc-content-gray-muted" />
    </NcButton>

    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItem
          v-if="currentPageBookmarkInfo"
          data-testid="nc-bookmark-toggle-current-page"
          @click="toggleCurrentPageBookmark"
        >
          <div class="flex gap-2 items-center">
            <GeneralIcon
              :icon="isCurrentPageBookmarked ? 'ncBookmarkSolid' : 'ncBookmark'"
              class="w-4 h-4"
              :class="isCurrentPageBookmarked ? 'text-nc-content-brand' : ''"
            />
            {{ isCurrentPageBookmarked ? $t('labels.removePageBookmark') : $t('labels.bookmarkThisPage') }}
          </div>
        </NcMenuItem>
        <NcDivider v-if="currentPageBookmarkInfo" />
        <NcMenuItem data-testid="nc-bookmark-new-folder-action" @click="onNewFolder">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncFolderPlus" class="w-4 h-4" />
            {{ $t('labels.newFolder') }}
          </div>
        </NcMenuItem>
        <NcMenuItem v-if="hasGroups" :disabled="!canCollapseAll" data-testid="nc-bookmark-collapse-all" @click="onCollapseAll">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="minimizeAll" class="w-4 h-4 text-nc-content-gray-muted" />
            {{ $t('labels.collapseAll') }}
          </div>
        </NcMenuItem>
        <NcMenuItem v-if="hasGroups" :disabled="!canExpandAll" data-testid="nc-bookmark-expand-all" @click="onExpandAll">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="maximizeAll" class="w-4 h-4 text-nc-content-gray-muted" />
            {{ $t('labels.expandAll') }}
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>
</template>
