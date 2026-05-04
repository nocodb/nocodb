<script setup lang="ts">
import type { BookmarkType, BookmarkGroupType } from 'nocodb-sdk'

interface Props {
  group: BookmarkGroupType
  bookmarks: BookmarkType[]
  allGroups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { group, bookmarks: groupBookmarks, allGroups } = toRefs(props)

const emit = defineEmits<{ navigate: [bookmark: BookmarkType] }>()

const { updateGroup, isGroupCollapsed, toggleGroupCollapsed } = useBookmarks()

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

function onToggleCollapse() {
  if (isRenaming.value) return
  toggleGroupCollapsed(group.value.id!)
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
    class="nc-v2-stack-group"
    :class="{ 'is-drop-target': isDropTarget, 'is-dragging': isDraggingGroup }"
    :data-group-id="group.id"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="onDragLeaveGroup(group.id!)"
    @drop.prevent="handleDrop"
  >
    <!-- Header — full width, right-click opens the same menu as the kebab.
         Ungrouped is pinned and not draggable. -->
    <div
      class="nc-v2-stack-h group"
      :draggable="!isDefault"
      data-testid="nc-bookmark-group-header"
      @dragstart="handleGroupDragStart"
      @dragend="onDragEnd"
      @click="onToggleCollapse"
      @contextmenu.prevent="ctxMenuRef?.open()"
    >
      <GeneralIcon
        :icon="isCollapsed ? 'ncFolderClosed' : 'ncFolderOpen'"
        class="nc-v2-stack-folder-icon"
        :style="iconColor ? { color: iconColor } : undefined"
      />

      <a-input
        v-if="isRenaming"
        ref="renameInputRef"
        v-model:value="renameValue"
        class="nc-v2-stack-rename"
        size="small"
        data-testid="nc-bookmark-group-rename-input"
        @keyup.enter="saveRename"
        @keyup.escape="cancelRename"
        @blur="saveRename"
        @click.stop
      />
      <div v-else class="nc-v2-stack-name-wrap">
        <NcTooltip
          show-on-truncate-only
          :attrs="{ class: 'nc-v2-stack-name truncate block' }"
        >
          {{ group.name }}
        </NcTooltip>
      </div>

      <span class="nc-v2-stack-count">{{ String(groupBookmarks.length).padStart(2, '0') }}</span>

      <BookmarksV2GroupContextMenu
        ref="ctxMenuRef"
        :group="group"
        class="nc-v2-stack-kebab opacity-0 group-hover:opacity-100"
        @rename="startRename"
      />
    </div>

    <!-- Items -->
    <template v-if="!isCollapsed">
      <div ref="listRef" class="nc-v2-stack-items">
        <template v-for="(bm, idx) in groupBookmarks" :key="bm.id">
          <div
            v-if="localDropIndex === idx && bm.id !== draggingBookmarkId"
            class="nc-v2-stack-drop-line"
          />
          <BookmarksV2Item
            :bookmark="bm"
            :groups="allGroups"
            :show-crumb-on-hover="true"
            @click="emit('navigate', bm)"
          />
        </template>
        <div
          v-if="localDropIndex === groupBookmarks.length && groupBookmarks.length > 0"
          class="nc-v2-stack-drop-line"
        />
      </div>

      <div v-if="!groupBookmarks.length" class="nc-v2-stack-empty">
        {{ $t('labels.noData') }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-v2-stack-group {
  @apply px-3 pt-3 pb-1;
  & + & {
    @apply mt-1 border-t-1 border-dashed border-nc-border-gray-medium;
  }
  &.is-drop-target {
    background: color-mix(in srgb, var(--nc-content-brand) 6%, transparent);
  }
  &.is-dragging {
    @apply opacity-40;
  }
}

.nc-v2-stack-h {
  @apply flex items-center gap-2.5 mb-1.5 px-1 cursor-pointer select-none min-w-0;
}
.nc-v2-stack-folder-icon {
  @apply flex-none w-3.5 h-3.5 text-nc-content-gray-muted;
}
.nc-v2-stack-group:hover .nc-v2-stack-folder-icon {
  @apply text-nc-content-gray-subtle;
}
.nc-v2-stack-name-wrap {
  @apply flex-1 min-w-0;
}
.nc-v2-stack-name-wrap :deep(.nc-v2-stack-name) {
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--nc-content-gray-muted);
}
.nc-v2-stack-rename {
  @apply flex-1 !text-bodySm;
}
.nc-v2-stack-rename :deep(.ant-input) {
  font-size: 11px !important;
  line-height: 16px !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}
.nc-v2-stack-count {
  @apply flex-none text-captionXs text-nc-content-gray-disabled;
  font-family: 'JetBrainsMono', ui-monospace, monospace;
}
.nc-v2-stack-kebab {
  @apply !rounded-md flex-none transition-opacity;
}
.nc-v2-stack-kebab.invisible {
  @apply invisible;
}

.nc-v2-stack-items {
  @apply flex flex-col;
}
.nc-v2-stack-drop-line {
  @apply h-0.5 mx-2 my-0.5 rounded-full bg-nc-content-brand;
}
.nc-v2-stack-empty {
  @apply px-2.5 py-1 text-bodySm text-nc-content-gray-muted;
}
</style>
