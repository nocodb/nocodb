<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

interface Props {
  group: BookmarkGroupType
  bookmarks: BookmarkType[]
  allGroups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { group, bookmarks: groupBookmarks, allGroups } = toRefs(props)

const { updateGroup, isGroupCollapsed, toggleGroupCollapsed } = useBookmarks()

const { isEditing, groupSelectionState, toggleGroup } = useBookmarkEdit()

const {
  hoverGroupId,
  dropIndex,
  draggingBookmarkId,
  draggingGroupId,
  groupDropIndex,
  onDragEnterGroup,
  onDragLeaveGroup,
  onDropOnGroup,
  onDropGroup,
  updateDropIndex,
  onGroupDragStart,
  onDragEnd,
} = useBookmarkDnd()

const { $e } = useNuxtApp()

const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<any>()
const listRef = ref<HTMLElement>()
const ctxMenuRef = ref<any>()

const isDefault = computed(() => group.value.name === 'Ungrouped')
const isCollapsed = computed(() => isGroupCollapsed(group.value.id!))
const isDraggingGroup = computed(() => draggingGroupId.value === group.value.id)
const isDropTarget = computed(() => hoverGroupId.value === group.value.id && !draggingGroupId.value)
const localDropIndex = computed(() => (isDropTarget.value ? dropIndex.value : null))

const iconColor = computed(() => (group.value.meta as Record<string, any> | undefined)?.iconColor || '')

// Edit-mode selection state. The folder checkbox is a bulk-select shortcut
// for the group's bookmarks — including Ungrouped. We still skip Ungrouped
// in `fullySelectedGroupIds` upstream, so a fully-ticked Ungrouped only
// deletes its items, never the folder itself (Ungrouped auto-recreates).
const checkboxState = computed(() => groupSelectionState(group.value.id!))
const showFolderCheckbox = computed(() => isEditing.value)

function onHeaderClick() {
  if (isRenaming.value) return
  // In edit mode, clicking the row toggles the group selection. The folder
  // icon stops propagation so collapse/expand still works.
  if (isEditing.value) {
    toggleGroup(group.value.id!)
    return
  }
  toggleGroupCollapsed(group.value.id!)
}

function startRename() {
  renameValue.value = group.value.name ?? ''
  isRenaming.value = true
  nextTick(() => {
    renameInputRef.value?.focus?.()
    renameInputRef.value?.select?.()
  })
}

async function saveRename() {
  const next = renameValue.value.trim()
  if (!next) {
    cancelRename()
    return
  }
  await updateGroup(group.value.id!, { name: next })
  $e('a:bookmark:group:rename')
  cancelRename()
}

function cancelRename() {
  isRenaming.value = false
  renameValue.value = ''
}

function handleGroupDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `group:${group.value.id}`)
  }
  onGroupDragStart(group.value.id!)
}

let rafId: number | null = null

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (draggingGroupId.value) return

  const clientY = e.clientY
  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    // Drag may have ended (drop + dragend) before the raf fires; bail to avoid
    // re-asserting drop state that onDragEnd just cleared.
    if (!draggingBookmarkId.value && !draggingGroupId.value) return
    if (!listRef.value) return
    const items = listRef.value.querySelectorAll('[data-testid="nc-bookmark-item"]')
    let idx = groupBookmarks.value.length
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      if (clientY < midY) {
        idx = i
        break
      }
    }
    updateDropIndex(group.value.id!, idx)
  })
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  if (!draggingGroupId.value) onDragEnterGroup(group.value.id!)
}

function handleDrop() {
  if (draggingGroupId.value) onDropGroup(groupDropIndex.value ?? 0)
  else onDropOnGroup(group.value.id!)
}
</script>

<template>
  <div
    class="nc-bookmark-list-group"
    :class="{ 'is-drop-target': isDropTarget, 'is-dragging': isDraggingGroup, 'is-collapsed': isCollapsed }"
    :data-group-id="group.id"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="onDragLeaveGroup(group.id!)"
    @drop.prevent="handleDrop"
  >
    <!-- Header — full width, right-click opens the same menu as the kebab.
         Ungrouped is pinned and not draggable. -->
    <div
      class="nc-bookmark-list-h group"
      :draggable="!isDefault"
      data-testid="nc-bookmark-group-header"
      @dragstart="handleGroupDragStart"
      @dragend="onDragEnd"
      @click="onHeaderClick"
      @contextmenu.prevent="ctxMenuRef?.open()"
    >
      <NcCheckbox
        v-if="showFolderCheckbox"
        :checked="checkboxState === 'checked'"
        :indeterminate="checkboxState === 'indeterminate'"
        class="nc-bookmark-list-check"
        data-testid="nc-bookmark-group-checkbox"
        @click.stop
        @change="toggleGroup(group.id!)"
      />

      <GeneralIcon
        :icon="isCollapsed ? 'ncFolderClosed' : 'ncFolderOpen'"
        class="nc-bookmark-list-folder-icon"
        :style="iconColor ? { color: iconColor } : undefined"
        @click.stop="toggleGroupCollapsed(group.id!)"
      />

      <a-input
        v-if="isRenaming"
        ref="renameInputRef"
        v-model:value="renameValue"
        class="nc-bookmark-list-rename"
        size="small"
        data-testid="nc-bookmark-group-rename-input"
        @keyup.enter="saveRename"
        @keyup.escape="cancelRename"
        @blur="saveRename"
        @click.stop
      />
      <div v-else class="nc-bookmark-list-name-wrap">
        <NcTooltip show-on-truncate-only :attrs="{ class: 'nc-bookmark-list-name truncate block' }">
          {{ group.name }}
        </NcTooltip>
      </div>

      <span class="nc-bookmark-list-count">{{ String(groupBookmarks.length).padStart(2, '0') }}</span>

      <BookmarksGroupContextMenu
        ref="ctxMenuRef"
        :group="group"
        class="nc-bookmark-list-kebab opacity-0 group-hover:opacity-100"
        @rename="startRename"
      />
    </div>

    <!-- Items -->
    <template v-if="!isCollapsed">
      <div ref="listRef" class="nc-bookmark-list-items">
        <template v-for="(bm, idx) in groupBookmarks" :key="bm.id">
          <div v-if="localDropIndex === idx && bm.id !== draggingBookmarkId" class="nc-bookmark-list-drop-line" />
          <BookmarksItem :bookmark="bm" :groups="allGroups" :show-crumb-on-hover="true" />
        </template>
        <div v-if="localDropIndex === groupBookmarks.length && groupBookmarks.length > 0" class="nc-bookmark-list-drop-line" />
      </div>

      <div v-if="!groupBookmarks.length" class="nc-bookmark-list-empty">
        {{ $t('labels.noData') }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-list-group {
  @apply px-3 first-of-type:pt-3 pb-0 last-of-type:pb-2;
  &.is-drop-target {
    background: color-mix(in srgb, var(--nc-content-brand) 6%, transparent);
  }
  &.is-dragging {
    @apply opacity-40;
  }
}

.nc-bookmark-list-h {
  @apply flex items-center gap-2.5 px-1 min-h-8 cursor-pointer select-none min-w-0;
}
.nc-bookmark-list-group:not(.is-collapsed) .nc-bookmark-list-h {
  @apply mb-1;
}
.nc-bookmark-list-check {
  @apply flex-none;
}
.nc-bookmark-list-folder-icon {
  @apply flex-none w-4 h-4 text-nc-content-gray-muted;
}
.nc-bookmark-list-group:hover .nc-bookmark-list-folder-icon {
  @apply text-nc-content-gray-subtle;
}
.nc-bookmark-list-name-wrap {
  @apply flex-1 min-w-0;
}
.nc-bookmark-list-name-wrap :deep(.nc-bookmark-list-name) {
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--nc-content-gray-muted);
}
.nc-bookmark-list-rename {
  @apply flex-1 !text-bodySm !rounded-md;
}
.nc-bookmark-list-rename :deep(.ant-input) {
  font-size: 11px !important;
  line-height: 16px !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}
.nc-bookmark-list-count {
  @apply flex-none text-captionXs text-nc-content-gray-disabled;
  font-family: 'JetBrainsMono', ui-monospace, monospace;
}
.nc-bookmark-list-kebab {
  @apply !rounded-md flex-none transition-opacity;
}
.nc-bookmark-list-kebab.invisible {
  @apply invisible;
}

.nc-bookmark-list-items {
  @apply flex flex-col;
}
.nc-bookmark-list-drop-line {
  @apply h-0.5 mx-2 my-0.5 rounded-full bg-nc-content-brand;
}
.nc-bookmark-list-empty {
  @apply px-2.5 py-1 text-bodySm text-nc-content-gray-muted;
}
</style>
