<script setup lang="ts">
import type { BookmarkType } from 'nocodb-sdk'

const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks, addGroup, isCreatingFolder } =
  useBookmarks()

const { draggingGroupId, groupDropIndex, updateGroupDropIndex, onDropGroup, onDragEnd } = useBookmarkDnd()

const { $e } = useNuxtApp()

const emit = defineEmits<{ close: [] }>()

const searchQuery = ref('')

const showSearchBox = ref(false)

const searchInputRef = ref<HTMLInputElement>()

const isSearchButtonVisible = computed(() => !searchQuery.value && !showSearchBox.value)

function handleShowSearchInput() {
  showSearchBox.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function handleSearchBlur() {
  if (!searchQuery.value) {
    showSearchBox.value = false
  }
}

const newFolderName = ref('')

const newFolderInput = ref<any>()

const groupListRef = ref<HTMLElement>()

const filteredBookmarksByGroup = computed<Record<string, BookmarkType[]>>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return bookmarksByGroup.value

  const map: Record<string, BookmarkType[]> = {}
  for (const groupId in bookmarksByGroup.value) {
    const filtered = bookmarksByGroup.value[groupId].filter((bm) => {
      const title = (bm.title ?? bm.resolved_title ?? '').toLowerCase()
      return title.includes(q)
    })
    if (filtered.length) {
      map[groupId] = filtered
    }
  }
  return map
})

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return orderedGroups.value
  return orderedGroups.value.filter((g) => filteredBookmarksByGroup.value[g.id!]?.length)
})

const isEmpty = computed(() => orderedGroups.value.length === 0)

const COLUMN_COUNT = 3

const groupColumns = computed(() => {
  const cols: Array<Array<{ group: (typeof filteredGroups.value)[0]; originalIndex: number }>> = Array.from(
    { length: COLUMN_COUNT },
    () => [],
  )

  filteredGroups.value.forEach((group, idx) => {
    cols[idx % COLUMN_COUNT].push({ group, originalIndex: idx })
  })

  return cols
})

// Which group should show a drop indicator line above it
const dropTargetGroupId = computed(() => {
  if (!draggingGroupId.value || groupDropIndex.value == null) return null
  return filteredGroups.value[groupDropIndex.value]?.id ?? null
})

let groupRafId: number | null = null

function handleGroupListDragOver(e: DragEvent) {
  if (!draggingGroupId.value || !groupListRef.value) return

  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  const clientX = e.clientX
  const clientY = e.clientY

  if (groupRafId != null) return
  groupRafId = requestAnimationFrame(() => {
    groupRafId = null

    if (!groupListRef.value) return

    // 1. Find which column the cursor is in
    const colEls = groupListRef.value.children
    let colIdx = -1
    for (let i = 0; i < colEls.length; i++) {
      const rect = colEls[i].getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        colIdx = i
        break
      }
    }
    if (colIdx === -1) return

    // 2. Find position within column by checking group elements
    const col = groupColumns.value[colIdx]
    const groupEls = colEls[colIdx].querySelectorAll('[data-group-id]')
    let posInCol = col.length
    for (let i = 0; i < groupEls.length; i++) {
      const rect = groupEls[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        posInCol = i
        break
      }
    }

    // 3. Convert column position to logical index: row * COLUMN_COUNT + col
    const logicalIdx = posInCol * COLUMN_COUNT + colIdx
    updateGroupDropIndex(Math.min(logicalIdx, filteredGroups.value.length))
  })
}

function handleGroupListDrop(e: DragEvent) {
  if (!draggingGroupId.value) return
  e.preventDefault()
  onDropGroup(groupDropIndex.value ?? orderedGroups.value.length)
}

function handleGroupListDragEnd() {
  onDragEnd()
}

function onNavigate(bm: BookmarkType) {
  navigateToBookmark(bm)
  emit('close')
}

watch(isCreatingFolder, (val) => {
  if (val) {
    newFolderName.value = ''
    nextTick(() => {
      newFolderInput.value?.focus()
    })
  }
})

async function confirmNewFolder() {
  const name = newFolderName.value.trim()
  if (!name) {
    isCreatingFolder.value = false
    return
  }

  const group = await addGroup({ name })
  if (group) $e('a:bookmark:group:create')
  isCreatingFolder.value = false
  newFolderName.value = ''
}

function cancelNewFolder() {
  isCreatingFolder.value = false
  newFolderName.value = ''
}

onMounted(() => {
  loadBookmarks()
})
</script>

<template>
  <div
    class="nc-bookmarks-flyout fixed bg-nc-bg-default dark:bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-xl shadow-lg z-50 flex flex-col"
    style="left: 60px; bottom: 18px; width: 540px; height: 80vh"
    @click.stop
    @keydown.stop
  >
    <!-- Header -->
    <div class="flex items-center gap-2 px-4 py-3 border-b-1 border-nc-border-gray-medium flex-none">
      <span class="text-sm font-bold text-nc-content-gray">{{ $t('title.bookmarks') }}</span>

      <div class="flex-1" />

      <template v-if="!isEmpty">
        <a-input
          v-if="!isSearchButtonVisible"
          ref="searchInputRef"
          v-model:value="searchQuery"
          :placeholder="$t('general.search')"
          class="!rounded-lg !w-52 nc-input-sm"
          allow-clear
          data-testid="nc-bookmark-flyout-search"
          @blur="handleSearchBlur"
          @keydown.escape="handleSearchBlur"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="text-nc-content-gray-muted mr-1" />
          </template>
        </a-input>
        <NcButton v-else type="text" size="small" @click="handleShowSearchInput">
          <GeneralIcon icon="search" class="text-nc-content-gray-muted" />
        </NcButton>
      </template>

      <BookmarksAddBookmarkDropdown />
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-3.5 pb-6">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <GeneralLoader />
      </div>

      <!-- Empty state -->
      <div v-else-if="isEmpty && !isCreatingFolder" class="flex flex-col items-center justify-center py-8 gap-2">
        <GeneralIcon icon="ncBookmark" class="w-8 h-8 text-nc-content-gray-subtle" />
        <span class="text-sm text-nc-content-gray-subtle text-center px-4">{{ $t('msg.noBookmarksYet') }}</span>
      </div>

      <!-- No search results -->
      <div
        v-if="!isEmpty && searchQuery.trim() && !filteredGroups.length"
        class="text-xs text-nc-content-gray-muted text-center py-6"
      >
        {{ $t('labels.noResults') }}
      </div>

      <!-- Groups in columns -->
      <div
        v-else-if="!isEmpty"
        ref="groupListRef"
        class="flex gap-4"
        @dragover="handleGroupListDragOver"
        @drop="handleGroupListDrop"
        @dragend="handleGroupListDragEnd"
      >
        <div v-for="(col, colIdx) in groupColumns" :key="colIdx" class="flex-1 flex flex-col gap-3 min-w-0">
          <template v-for="{ group } in col" :key="group.id">
            <!-- Drop indicator line before this group -->
            <div
              v-if="dropTargetGroupId === group.id && group.id !== draggingGroupId"
              class="h-0.5 bg-nc-content-brand rounded-full -mb-2"
            />

            <BookmarksFlyoutGroup
              :group="group"
              :bookmarks="filteredBookmarksByGroup[group.id!] ?? []"
              :all-groups="orderedGroups"
              @navigate="onNavigate"
            />
          </template>

          <!-- Drop indicator at end of column if dropping past last item -->
          <div
            v-if="draggingGroupId && groupDropIndex === filteredGroups.length && colIdx === filteredGroups.length % COLUMN_COUNT"
            class="h-0.5 bg-nc-content-brand rounded-full"
          />

          <!-- New folder placeholder in last column -->
          <div
            v-if="isCreatingFolder && colIdx === filteredGroups.length % COLUMN_COUNT"
            class="flex flex-col gap-0.5 rounded-lg"
          >
            <div class="flex items-center gap-1 px-1">
              <a-input
                ref="newFolderInput"
                v-model:value="newFolderName"
                :placeholder="$t('labels.bookmarkGroup')"
                class="!rounded-lg flex-1"
                data-testid="nc-bookmark-new-folder-input"
                @keydown.enter="confirmNewFolder"
                @keydown.escape="cancelNewFolder"
              />
              <NcButton type="text" size="xxsmall" @click="confirmNewFolder">
                <GeneralIcon icon="check" class="text-nc-content-brand" />
              </NcButton>
              <NcButton type="text" size="xxsmall" @click="cancelNewFolder">
                <GeneralIcon icon="close" class="text-nc-content-gray-muted" />
              </NcButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
