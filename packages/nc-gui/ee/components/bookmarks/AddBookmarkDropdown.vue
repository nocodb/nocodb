<script setup lang="ts">
import type { BookmarkReqType } from 'nocodb-sdk'

const { $api, $e } = useNuxtApp()

const { addBookmark, isBookmarked, getBookmark, removeBookmark, isCreatingFolder } = useBookmarks()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const isDropdownOpen = ref(false)

const isModalOpen = ref(false)

const searchInputRef = ref<any>()

const searchQuery = ref('')

const isSearching = ref(false)

const searchResults = ref<any[]>([])

const allItems = ref<any[]>([])

// --- Dropdown actions ---

function onNewBookmark() {
  isDropdownOpen.value = false
  isModalOpen.value = true
}

function onNewFolder() {
  isDropdownOpen.value = false
  isCreatingFolder.value = true
}

// --- Search modal ---

async function loadItems() {
  if (!activeWorkspace.value?.id) return

  isSearching.value = true

  try {
    const res = await $api.utils.commandPalette({
      scope: `ws-${activeWorkspace.value.id}`,
      data: { workspace_id: activeWorkspace.value.id },
    })

    allItems.value = (res || []).filter((item: any) => {
      const id = item.id || ''
      return id.startsWith('p-') || id.startsWith('tbl-') || id.startsWith('vw-')
    })
  } catch {
    allItems.value = []
  } finally {
    isSearching.value = false
  }
}

const debouncedFilter = useDebounceFn(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) {
    searchResults.value = []
    return
  }
  searchResults.value = allItems.value.filter((item: any) =>
    (item.title || '').toLowerCase().includes(q),
  )
}, 200)

watch(searchQuery, () => {
  debouncedFilter()
})

watch(isModalOpen, (val) => {
  if (val) {
    loadItems()
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  } else {
    searchQuery.value = ''
    searchResults.value = []
  }
})

function getResultTargetType(item: any): string | null {
  const id = item.id || ''
  if (id.startsWith('p-')) return 'base'
  if (id.startsWith('tbl-')) return 'table'
  if (id.startsWith('vw-')) return 'view'
  return null
}

function getResultTargetId(item: any): string {
  const id = item.id || ''
  const dashIdx = id.indexOf('-')
  return dashIdx >= 0 ? id.slice(dashIdx + 1) : id
}

function getResultMeta(item: any): Record<string, any> {
  const targetType = getResultTargetType(item)
  const workspaceId = activeWorkspace.value?.id

  if (targetType === 'base') {
    return { workspace_id: workspaceId }
  }

  if (targetType === 'table') {
    const parent = item.parent || ''
    const baseId = parent.startsWith('p-') ? parent.slice(2) : undefined
    return { workspace_id: workspaceId, base_id: baseId }
  }

  if (targetType === 'view') {
    const payload: string = item.handler?.payload || ''
    const parts = payload.split('/').filter(Boolean)
    return {
      workspace_id: parts[0] || workspaceId,
      base_id: parts[1],
      table_id: parts[2],
    }
  }

  return {}
}

function isResultBookmarked(item: any): boolean {
  const targetType = getResultTargetType(item)
  const targetId = getResultTargetId(item)
  if (!targetType) return false
  return isBookmarked(targetType, targetId, getResultMeta(item))
}

async function toggleBookmark(item: any) {
  const targetType = getResultTargetType(item)
  const targetId = getResultTargetId(item)
  if (!targetType) return

  const meta = getResultMeta(item)

  if (isResultBookmarked(item)) {
    const bm = getBookmark(targetType, targetId)
    if (bm) await removeBookmark(bm.id!)
  } else {
    await addBookmark({
      target_type: targetType,
      target_id: targetId,
      meta,
    } as BookmarkReqType)
  }
}

function getResultIcon(item: any): string {
  const targetType = getResultTargetType(item)
  if (targetType === 'base') return 'ncDatabase'
  if (targetType === 'table') return 'table'
  if (targetType === 'view') return 'grid'
  return 'search'
}
</script>

<template>
  <!-- "+" dropdown with two options -->
  <NcDropdown v-model:visible="isDropdownOpen" :trigger="['click']" overlay-class-name="nc-bookmark-add-dropdown">
    <NcButton
      type="text"
      size="xxsmall"
      class="!rounded-md"
      data-testid="nc-bookmark-add-btn"
      @click.stop
    >
      <GeneralIcon icon="plus" class="text-nc-content-gray-muted" />
    </NcButton>

    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItem data-testid="nc-bookmark-new-bookmark" @click="onNewBookmark">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncBookmark" class="w-4 h-4" />
            {{ $t('labels.newBookmark') }}
          </div>
        </NcMenuItem>
        <NcMenuItem data-testid="nc-bookmark-new-folder-action" @click="onNewFolder">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncFolderPlus" class="w-4 h-4" />
            {{ $t('labels.newFolder') }}
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>

  <!-- Search modal for adding bookmarks -->
  <NcModal v-model:visible="isModalOpen" size="sm" :mask-closable="true">
    <div class="flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <span class="text-sm font-bold text-nc-content-gray">{{ $t('labels.addToBookmarks') }}</span>
      </div>

      <!-- Search input -->
      <div class="px-4 pb-3">
        <a-input
          ref="searchInputRef"
          v-model:value="searchQuery"
          :placeholder="$t('labels.searchBasesTablesViews')"
          class="!rounded-lg"
          data-testid="nc-bookmark-search-input"
          allow-clear
        >
          <template #prefix>
            <GeneralIcon icon="search" class="text-nc-content-gray-muted mr-1" />
          </template>
        </a-input>
      </div>

      <!-- Search results -->
      <div class="max-h-64 overflow-y-auto nc-scrollbar-thin px-2">
        <!-- Loading -->
        <div v-if="isSearching" class="flex items-center justify-center py-6">
          <GeneralLoader size="small" />
        </div>

        <!-- Results -->
        <template v-else-if="searchResults.length">
          <div
            v-for="item in searchResults"
            :key="item.id"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-nc-bg-gray-light"
            data-testid="nc-bookmark-search-result"
            @click="toggleBookmark(item)"
          >
            <GeneralIcon :icon="getResultIcon(item)" class="w-4 h-4 text-nc-content-gray-muted flex-none" />
            <span class="truncate flex-1 text-small text-nc-content-gray">{{ item.title }}</span>
            <GeneralIcon
              v-if="isResultBookmarked(item)"
              icon="ncBookmark"
              class="w-4 h-4 text-nc-content-brand flex-none"
            />
          </div>
        </template>

        <!-- Empty state (only when query exists) -->
        <div v-else-if="searchQuery.trim()" class="text-xs text-nc-content-gray-muted text-center py-6 px-3">
          {{ $t('labels.noResults') }}
        </div>

        <!-- Initial state -->
        <div v-else class="text-xs text-nc-content-gray-muted text-center py-6 px-3">
          {{ $t('labels.searchBasesTablesViews') }}
        </div>
      </div>
    </div>
  </NcModal>
</template>
