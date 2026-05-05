<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'
import Draggable from 'vuedraggable'

const {
  bookmarks,
  groups,
  orderedGroups,
  bookmarksByGroup,
  isLoading,
  loadBookmarks,
  removeBookmark,
  updateBookmark,
  addGroup,
  removeGroup,
  updateGroup,
  navigateToBookmark,
} = useBookmarks()

const { blockBookmarks, showUpgradeToUseBookmarks } = useEeConfig()
const { t } = useI18n()

const isCreatingGroup = ref(false)
const newGroupName = ref('')
const isDraggingGroup = ref(false)
const isDraggingBookmark = ref(false)

// Inline rename state
const renamingBookmarkId = ref<string | null>(null)
const renameValue = ref('')
const useOriginalName = ref(false)

function startRename(bm: BookmarkType) {
  renamingBookmarkId.value = bm.id!
  useOriginalName.value = !bm.title
  renameValue.value = bm.title ?? ''
}

function cancelRename() {
  renamingBookmarkId.value = null
  renameValue.value = ''
  useOriginalName.value = false
}

async function saveRename(bmId: string) {
  const newTitle = useOriginalName.value ? null : (renameValue.value.trim() || null)
  await updateBookmark(bmId, { title: newTitle })
  cancelRename()
}

function onToggleOriginalName(bm: BookmarkType) {
  useOriginalName.value = !useOriginalName.value
  if (useOriginalName.value) {
    renameValue.value = bm.title ?? ''
  }
}

function getDisplayTitle(bm: BookmarkType): string {
  return bm.title ?? ''
}

function isAutoResolved(bm: BookmarkType): boolean {
  return !bm.title
}

// Group inline rename state
const renamingGroupId = ref<string | null>(null)
const renameGroupValue = ref('')

function startGroupRename(group: BookmarkGroupType) {
  renamingGroupId.value = group.id!
  renameGroupValue.value = group.name
}

function cancelGroupRename() {
  renamingGroupId.value = null
  renameGroupValue.value = ''
}

async function saveGroupRename(groupId: string) {
  const newName = renameGroupValue.value.trim()
  if (!newName) return

  await updateGroup(groupId, { name: newName })
  cancelGroupRename()
}

// Mutable copy of ordered groups for drag-and-drop reordering
const draggableGroups = ref<BookmarkGroupType[]>([])

// Mutable per-group bookmark lists for cross-group drag-and-drop
const draggableBookmarks = ref<Record<string, BookmarkType[]>>({})

watch(
  orderedGroups,
  (val) => {
    draggableGroups.value = [...val]
  },
  { immediate: true },
)

watch(
  bookmarksByGroup,
  (val) => {
    const map: Record<string, BookmarkType[]> = {}
    for (const groupId in val) {
      map[groupId] = [...val[groupId]]
    }
    draggableBookmarks.value = map
  },
  { immediate: true },
)

async function onGroupReorder() {
  const updates: Promise<any>[] = []

  draggableGroups.value.forEach((group, idx) => {
    if (group.order !== idx) {
      updates.push(updateGroup(group.id!, { order: idx }))
    }
  })

  await Promise.all(updates)
}

async function onBookmarkChange(groupId: string, evt: any) {
  const list = draggableBookmarks.value[groupId] ?? []

  // Handle item added from another group (cross-group move)
  if (evt.added) {
    const bm = evt.added.element as BookmarkType
    await updateBookmark(bm.id!, { fk_group_id: groupId, order: evt.added.newIndex })
  }

  // Handle reorder within the same group
  if (evt.moved) {
    // Update order for all items in this group
    const updates: Promise<any>[] = []

    list.forEach((bm, idx) => {
      if (bm.order !== idx) {
        updates.push(updateBookmark(bm.id!, { order: idx }))
      }
    })

    await Promise.all(updates)
  }
}

async function onMoveToGroup(bookmarkId: string, targetGroupId: string) {
  await updateBookmark(bookmarkId, { fk_group_id: targetGroupId })
}

async function onCreateGroup() {
  if (!newGroupName.value.trim()) return

  await addGroup({ name: newGroupName.value.trim() })
  newGroupName.value = ''
  isCreatingGroup.value = false
}

async function onDeleteGroup(groupId: string) {
  const { showConfirmModal } = useNcConfirmModal()
  showConfirmModal({
    title: t('general.delete') + ' ' + t('labels.bookmarkGroup'),
    content: t('msg.confirmDeleteBookmarkGroup'),
    okCallback: async () => {
      await removeGroup(groupId)
    },
  })
}

const { activeWorkspaceId } = storeToRefs(useWorkspace())

watch(
  activeWorkspaceId,
  (id) => {
    if (!id) return

    if (blockBookmarks.value) {
      showUpgradeToUseBookmarks()
      return
    }

    loadBookmarks()
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col gap-6 p-6 max-w-250">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-nc-content-gray">
        {{ $t('title.bookmarks') }}
      </h1>

      <NcButton size="small" @click="isCreatingGroup = true">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="plus" class="w-4 h-4" />
          {{ $t('labels.createGroup') }}
        </div>
      </NcButton>
    </div>

    <!-- Create group input -->
    <div v-if="isCreatingGroup" class="flex items-center gap-2">
      <a-input
        v-model:value="newGroupName"
        :placeholder="$t('labels.bookmarkGroup')"
        class="!w-60"
        @keyup.enter="onCreateGroup"
        @keyup.escape="isCreatingGroup = false"
      />
      <NcButton size="small" @click="onCreateGroup">
        {{ $t('general.save') }}
      </NcButton>
      <NcButton size="small" type="text" @click="isCreatingGroup = false">
        {{ $t('general.cancel') }}
      </NcButton>
    </div>

    <!-- Loading -->
    <GeneralLoader v-if="isLoading" />

    <!-- Groups (draggable) -->
    <Draggable
      v-else
      v-model="draggableGroups"
      item-key="id"
      handle=".nc-group-drag-handle"
      ghost-class="nc-bookmark-group-ghost"
      class="flex flex-col gap-6"
      @change="onGroupReorder"
      @start="isDraggingGroup = true"
      @end="isDraggingGroup = false"
    >
      <template #item="{ element: group }">
        <div class="flex flex-col gap-2 border-1 border-nc-border-gray-medium rounded-lg p-4">
          <!-- Group header -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <component
                :is="iconMap.drag"
                class="nc-group-drag-handle !h-3.75 text-nc-content-gray-subtle2 cursor-move"
              />

              <!-- Group inline rename mode -->
              <template v-if="renamingGroupId === group.id">
                <a-input
                  v-model:value="renameGroupValue"
                  class="!w-60"
                  size="small"
                  @keyup.enter="saveGroupRename(group.id!)"
                  @keyup.escape="cancelGroupRename"
                />
                <NcButton size="xs" @click="saveGroupRename(group.id!)">
                  {{ $t('general.save') }}
                </NcButton>
                <NcButton size="xs" type="text" @click="cancelGroupRename">
                  {{ $t('general.cancel') }}
                </NcButton>
              </template>

              <!-- Group name display -->
              <span v-else class="text-sm font-semibold text-nc-content-gray">
                {{ group.name }}
              </span>
            </div>

            <!-- Group three-dot menu (not shown for Ungrouped) -->
            <NcDropdown v-if="group.name !== 'Ungrouped' && renamingGroupId !== group.id" :trigger="['click']">
              <NcButton type="text" size="xs">
                <GeneralIcon icon="threeDotVertical" class="w-4 h-4" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem @click="startGroupRename(group)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="rename" class="w-4 h-4" />
                      {{ $t('general.rename') }}
                    </div>
                  </NcMenuItem>

                  <NcDivider />

                  <NcMenuItem class="!text-nc-content-red-dark !hover:bg-red-50" @click="onDeleteGroup(group.id!)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="delete" class="w-4 h-4" />
                      {{ $t('general.delete') }}
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>

          <!-- Bookmarks in group (draggable, cross-group) -->
          <Draggable
            v-model="draggableBookmarks[group.id!]"
            item-key="id"
            :group="{ name: 'bookmarks' }"
            handle=".nc-bookmark-drag-handle"
            ghost-class="nc-bookmark-item-ghost"
            class="flex flex-col gap-0.5 min-h-8"
            @change="onBookmarkChange(group.id!, $event)"
            @start="isDraggingBookmark = true"
            @end="isDraggingBookmark = false"
          >
            <template #item="{ element: bm }">
              <div class="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-nc-bg-gray-light">
                <div class="flex items-center gap-3">
                  <component
                    :is="iconMap.drag"
                    class="nc-bookmark-drag-handle !h-3.75 text-nc-content-gray-subtle2 cursor-move flex-shrink-0"
                  />

                  <!-- Inline rename mode -->
                  <template v-if="renamingBookmarkId === bm.id">
                    <a-input
                      v-model:value="renameValue"
                      class="!flex-1"
                      size="small"
                      :disabled="useOriginalName"
                      :placeholder="bm.title ?? ''"
                      @keyup.enter="saveRename(bm.id!)"
                      @keyup.escape="cancelRename"
                    />
                    <NcButton size="xs" @click="saveRename(bm.id!)">
                      {{ $t('general.save') }}
                    </NcButton>
                    <NcButton size="xs" type="text" @click="cancelRename">
                      {{ $t('general.cancel') }}
                    </NcButton>
                  </template>

                  <!-- Normal display mode -->
                  <template v-else>
                    <BookmarksItem
                      :bookmark="bm"
                      class="flex-1 pointer-events-none"
                      :class="{ 'italic underline': !isAutoResolved(bm) }"
                    />

                    <span class="text-xs text-nc-content-gray-subtle capitalize flex-shrink-0">
                      {{ bm.target_type }}
                    </span>

                    <NcDropdown :trigger="['click']">
                      <NcButton type="text" size="xs">
                        <GeneralIcon icon="threeDotVertical" class="w-4 h-4" />
                      </NcButton>
                      <template #overlay>
                        <NcMenu>
                          <!-- Open -->
                          <NcMenuItem @click="navigateToBookmark(bm)">
                            <div class="flex items-center gap-2">
                              <GeneralIcon icon="ncExternalLink" class="w-4 h-4" />
                              {{ $t('general.open') }}
                            </div>
                          </NcMenuItem>

                          <NcDivider />

                          <!-- Rename -->
                          <NcMenuItem @click="startRename(bm)">
                            <div class="flex items-center gap-2">
                              <GeneralIcon icon="rename" class="w-4 h-4" />
                              {{ $t('general.rename') }}
                            </div>
                          </NcMenuItem>

                          <!-- Move to group submenu -->
                          <NcSubMenu key="move-to-group">
                            <template #title>
                              <div class="flex items-center gap-2">
                                <GeneralIcon icon="ncMove" class="w-4 h-4" />
                                {{ $t('general.move') }}
                              </div>
                            </template>
                            <template v-for="g in orderedGroups" :key="g.id">
                              <NcMenuItem v-if="g.id !== group.id" @click="onMoveToGroup(bm.id!, g.id!)">
                                {{ g.name }}
                              </NcMenuItem>
                            </template>
                          </NcSubMenu>

                          <NcDivider />

                          <!-- Delete -->
                          <NcMenuItem class="!text-nc-content-red-dark !hover:bg-red-50" @click="removeBookmark(bm.id!)">
                            <div class="flex items-center gap-2">
                              <GeneralIcon icon="delete" class="w-4 h-4" />
                              {{ $t('general.delete') }}
                            </div>
                          </NcMenuItem>
                        </NcMenu>
                      </template>
                    </NcDropdown>
                  </template>
                </div>

                <!-- Use original name toggle (shown only during rename) -->
                <div v-if="renamingBookmarkId === bm.id" class="flex items-center gap-2 ml-7.5">
                  <NcSwitch :checked="useOriginalName" size="small" @update:checked="onToggleOriginalName(bm)" />
                  <span class="text-xs text-nc-content-gray-subtle">
                    {{ $t('labels.useOriginalName') }}
                  </span>
                </div>
              </div>
            </template>
          </Draggable>

          <!-- Empty group (only when not dragging — hide to allow drop target) -->
          <div
            v-if="!(draggableBookmarks[group.id!]?.length) && !isDraggingBookmark"
            class="text-sm text-nc-content-gray-muted px-2 py-1"
          >
            {{ $t('labels.noData') }}
          </div>
        </div>
      </template>
    </Draggable>

    <!-- No groups at all -->
    <div v-if="!isLoading && !orderedGroups.length" class="text-sm text-nc-content-gray-muted">
      {{ $t('msg.noBookmarksYet') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-group-ghost {
  @apply opacity-50 bg-nc-bg-gray-light rounded-lg;
}

.nc-bookmark-item-ghost {
  @apply opacity-50 bg-nc-bg-brand-soft rounded-md;
}
</style>
