<script setup lang="ts">
import type { BookmarkType } from 'nocodb-sdk'

const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks, addGroup, isCreatingFolder } =
  useBookmarks()

const { draggingGroupId, groupDropIndex, updateGroupDropIndex, onDropGroup, onDragEnd } = useBookmarkDnd()

const { $e } = useNuxtApp()

const emit = defineEmits<{ close: [] }>()

const newFolderName = ref('')

const newFolderInput = ref<any>()

const groupListRef = ref<HTMLElement>()

const isEmpty = computed(() => orderedGroups.value.length === 0)

function handleGroupListDragOver(e: DragEvent) {
  if (!draggingGroupId.value || !groupListRef.value) return

  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  const groupEls = groupListRef.value.querySelectorAll('[data-testid="nc-bookmark-group-header"]')
  let idx = orderedGroups.value.length

  for (let i = 0; i < groupEls.length; i++) {
    const rect = groupEls[i].getBoundingClientRect()
    const midY = rect.top + rect.height / 2

    if (e.clientY < midY) {
      idx = i
      break
    }
  }

  updateGroupDropIndex(idx)
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
    class="nc-bookmarks-flyout fixed bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl shadow-lg z-50 flex flex-col"
    style="left: 60px; bottom: 18px; width: 340px; min-height: 300px; max-height: 80vh"
    @click.stop
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b-1 border-nc-border-gray-medium flex-none">
      <span class="text-sm font-bold text-nc-content-gray">{{ $t('title.bookmarks') }}</span>
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

      <!-- Single column list -->
      <div
        v-else
        ref="groupListRef"
        class="flex flex-col gap-4"
        @dragover="handleGroupListDragOver"
        @drop="handleGroupListDrop"
        @dragend="handleGroupListDragEnd"
      >
        <template v-for="(group, idx) in orderedGroups" :key="group.id">
          <!-- Group drop indicator line -->
          <div
            v-if="draggingGroupId && groupDropIndex === idx && group.id !== draggingGroupId"
            class="h-0.5 mx-1.5 bg-nc-content-brand rounded-full"
          />

          <BookmarksFlyoutGroup
            :group="group"
            :bookmarks="bookmarksByGroup[group.id!] ?? []"
            :all-groups="orderedGroups"
            @navigate="onNavigate"
          />
        </template>

        <!-- Group drop indicator at end -->
        <div
          v-if="draggingGroupId && groupDropIndex === orderedGroups.length"
          class="h-0.5 mx-1.5 bg-nc-content-brand rounded-full"
        />

        <!-- New folder placeholder -->
        <div v-if="isCreatingFolder" class="flex flex-col gap-0.5 rounded-lg">
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
</template>
