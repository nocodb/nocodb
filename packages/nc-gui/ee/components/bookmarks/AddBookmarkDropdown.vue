<script setup lang="ts">
import type { BookmarkReqType } from 'nocodb-sdk'

const { addBookmark, isBookmarked, getBookmark, removeBookmark, isCreatingFolder } = useBookmarks()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const tablesStore = useTablesStore()

const { activeTableId } = storeToRefs(tablesStore)

const viewsStore = useViewsStore()

const { activeView } = storeToRefs(viewsStore)

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const isDropdownOpen = ref(false)

// --- Current page bookmark ---

const currentPageBookmarkInfo = computed<{ targetType: string; targetId: string; meta: Record<string, any> } | null>(() => {
  const workspaceId = activeWorkspace.value?.id
  if (!workspaceId) return null

  const baseId = activeProjectId.value
  const tableId = activeTableId.value
  const viewId = activeView.value?.id

  // Most specific first: view → table → base → workspace
  if (viewId && tableId && baseId) {
    return {
      targetType: 'view',
      targetId: viewId,
      meta: { workspace_id: workspaceId, base_id: baseId, table_id: tableId },
    }
  }

  if (tableId && baseId) {
    return {
      targetType: 'table',
      targetId: tableId,
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
</script>

<template>
  <NcDropdown v-model:visible="isDropdownOpen" placement="bottomRight" overlay-class-name="nc-bookmark-add-dropdown">
    <NcButton type="text" size="small" class="!rounded-md" data-testid="nc-bookmark-add-btn" @click.stop>
      <GeneralIcon icon="plus" class="text-nc-content-gray-muted" />
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
      </NcMenu>
    </template>
  </NcDropdown>
</template>
