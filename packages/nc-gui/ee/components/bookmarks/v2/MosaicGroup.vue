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
  draggingBookmarkId,
  draggingGroupId,
  onDragEnterGroup,
  onDragLeaveGroup,
  onDropOnGroup,
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
      const r = items[i].getBoundingClientRect()
      const midY = r.top + r.height / 2
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
  onDropOnGroup(group.value.id!)
}
</script>

<template>
  <div
    class="nc-v2-mosaic-card"
    :class="{ 'is-drop-target': isDropTarget, 'is-dragging': isDraggingGroup, 'is-collapsed': isCollapsed }"
    :data-group-id="group.id"
    draggable="true"
    @dragstart="handleGroupDragStart"
    @dragend="onDragEnd"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="onDragLeaveGroup(group.id!)"
    @drop.prevent="handleDrop"
  >
    <!-- Header — right-click on row opens same menu as kebab -->
    <div
      class="nc-v2-mosaic-h group"
      @click="onToggleCollapse"
      @contextmenu.prevent="ctxMenuRef?.open()"
    >
      <GeneralIcon
        :icon="isCollapsed ? 'ncFolderClosed' : 'ncFolderOpen'"
        class="nc-v2-mosaic-folder-icon"
        :style="iconColor ? { color: iconColor } : undefined"
        @click.stop="onToggleCollapse"
      />

      <a-input
        v-if="isRenaming"
        ref="renameInputRef"
        v-model:value="renameValue"
        class="nc-v2-mosaic-rename"
        size="small"
        data-testid="nc-bookmark-group-rename-input"
        @keyup.enter="saveRename"
        @keyup.escape="cancelRename"
        @blur="saveRename"
        @click.stop
      />
      <div v-else class="nc-v2-mosaic-name-wrap" @click="onToggleCollapse">
        <NcTooltip
          show-on-truncate-only
          :attrs="{ class: 'nc-v2-mosaic-name truncate block' }"
        >
          {{ group.name }}
        </NcTooltip>
      </div>

      <span class="nc-v2-mosaic-count">{{ String(groupBookmarks.length).padStart(2, '0') }}</span>

      <BookmarksV2GroupContextMenu
        ref="ctxMenuRef"
        :group="group"
        class="nc-v2-mosaic-kebab opacity-0 group-hover:opacity-100"
        @rename="startRename"
      />
    </div>

    <!-- Items -->
    <template v-if="!isCollapsed">
      <div ref="listRef" class="nc-v2-mosaic-items">
        <BookmarksV2Item
          v-for="bm in groupBookmarks"
          :key="bm.id"
          :bookmark="bm"
          :groups="allGroups"
          :show-crumb-on-hover="false"
          :compact="true"
          @click="emit('navigate', bm)"
        />
      </div>
      <div v-if="!groupBookmarks.length" class="nc-v2-mosaic-empty">
        {{ $t('labels.noData') }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-v2-mosaic-card {
  @apply bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl px-3 pt-3 pb-2;
  @apply transition-colors;
  &.is-drop-target {
    border-color: var(--nc-content-brand);
  }
  &.is-dragging {
    @apply opacity-40;
  }
}

.nc-v2-mosaic-h {
  @apply flex items-center gap-2 pb-2 mb-1.5 border-b-1 border-nc-border-gray-medium min-w-0;
  cursor: pointer;
  user-select: none;
}
.nc-v2-mosaic-folder-icon {
  @apply flex-none w-4 h-4 text-nc-content-gray-muted cursor-pointer;
}
.nc-v2-mosaic-card:hover .nc-v2-mosaic-folder-icon {
  @apply text-nc-content-gray-subtle;
}
.nc-v2-mosaic-name-wrap {
  @apply flex-1 min-w-0;
}
.nc-v2-mosaic-name-wrap :deep(.nc-v2-mosaic-name) {
  @apply text-bodyDefaultSm font-semibold text-nc-content-gray;
}
.nc-v2-mosaic-rename {
  @apply flex-1 !text-bodyDefaultSm;
}
.nc-v2-mosaic-rename :deep(.ant-input) {
  font-size: 13px !important;
  line-height: 18px !important;
  font-weight: 600 !important;
}
.nc-v2-mosaic-count {
  @apply flex-none text-captionXs text-nc-content-gray-disabled;
  font-family: 'JetBrainsMono', ui-monospace, monospace;
}
.nc-v2-mosaic-kebab {
  @apply !rounded-md flex-none transition-opacity;
}
.nc-v2-mosaic-kebab.invisible {
  @apply invisible;
}

.nc-v2-mosaic-items {
  @apply flex flex-col gap-0;
}
.nc-v2-mosaic-empty {
  @apply px-2 py-1 text-bodySm text-nc-content-gray-muted italic;
}
</style>
