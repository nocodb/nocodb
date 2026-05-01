<script setup lang="ts">
import type { BookmarkType, BookmarkGroupType } from 'nocodb-sdk'

interface Props {
  group: BookmarkGroupType
  bookmarks: BookmarkType[]
  allGroups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { group, bookmarks: groupBookmarks, allGroups } = toRefs(props)

const emit = defineEmits<{
  navigate: [bookmark: BookmarkType]
}>()

const { removeGroup, updateGroup, isGroupCollapsed, toggleGroupCollapsed } = useBookmarks()

const { $e } = useNuxtApp()

const {
  hoverGroupId,
  dropIndex,
  draggingBookmarkId,
  draggingGroupId,
  onDragEnterGroup,
  onDragLeaveGroup,
  onDropOnGroup,
  updateDropIndex,
  onGroupDragStart,
  onDragEnd,
} = useBookmarkDnd()

const isGroupMenuOpen = ref(false)

const isRenaming = ref(false)

const renameValue = ref('')

const renameInputRef = ref<any>()

const listRef = ref<HTMLElement>()

const isDefaultGroup = computed(() => group.value.name === 'Ungrouped')

const isCollapsed = computed(() => isGroupCollapsed(group.value.id!))

const isDraggingGroup = computed(() => draggingGroupId.value === group.value.id)

const isDropTarget = computed(() => hoverGroupId.value === group.value.id && !draggingGroupId.value)

const localDropIndex = computed(() => {
  if (!isDropTarget.value) return null
  return dropIndex.value
})

function onRenameGroup() {
  isGroupMenuOpen.value = false
  renameValue.value = group.value.name ?? ''
  isRenaming.value = true
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

async function confirmRename() {
  const name = renameValue.value.trim()
  if (!name || name === group.value.name) {
    isRenaming.value = false
    return
  }

  await updateGroup(group.value.id!, { name })
  $e('a:bookmark:group:rename')
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}

async function onDeleteGroup() {
  await removeGroup(group.value.id!)
  $e('a:bookmark:group:delete')
  isGroupMenuOpen.value = false
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

function handleGroupDragEnd() {
  onDragEnd()
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  // If dragging a group, don't calculate bookmark drop index
  if (draggingGroupId.value) return

  // Calculate drop index from cursor Y position relative to items
  if (!listRef.value) return

  const items = listRef.value.querySelectorAll('[data-testid="nc-bookmark-item"]')
  let idx = groupBookmarks.value.length

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect()
    const midY = rect.top + rect.height / 2

    if (e.clientY < midY) {
      const bmId = groupBookmarks.value[i]?.id
      if (bmId === draggingBookmarkId.value) {
        idx = i
        break
      }
      idx = i
      break
    }
  }

  updateDropIndex(group.value.id!, idx)
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  if (!draggingGroupId.value) {
    onDragEnterGroup(group.value.id!)
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-0.5 rounded-lg transition-colors"
    :class="{
      'bg-nc-bg-brand-light/40': isDropTarget,
      'opacity-40': isDraggingGroup,
    }"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="onDragLeaveGroup(group.id!)"
    @drop.prevent="onDropOnGroup(group.id!)"
  >
    <!-- Group title row (draggable + clickable to collapse) -->
    <div
      class="group/header flex items-center justify-between px-1.5 mb-1.5 cursor-pointer select-none"
      draggable="true"
      data-testid="nc-bookmark-group-header"
      @dragstart="handleGroupDragStart"
      @dragend="handleGroupDragEnd"
      @click="onToggleCollapse"
    >
      <div class="flex items-center gap-1 flex-1 min-w-0">
        <GeneralIcon
          icon="chevronDown"
          class="text-nc-content-gray-muted !w-3.5 !h-3.5 transition-transform flex-none"
          :class="{ 'transform -rotate-90': isCollapsed }"
        />

        <!-- Inline rename input -->
        <a-input
          v-if="isRenaming"
          ref="renameInputRef"
          v-model:value="renameValue"
          class="!rounded-lg flex-1 !text-[11px]"
          size="small"
          data-testid="nc-bookmark-group-rename-input"
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
          @blur="confirmRename"
          @click.stop
        />

        <template v-else>
          <span class="text-[11px] font-semibold text-nc-content-gray-subtle truncate">
            {{ group.name }}
          </span>
          <span v-if="isCollapsed" class="text-[10px] text-nc-content-gray-muted flex-none">
            ({{ groupBookmarks.length }})
          </span>
        </template>
      </div>

      <!-- Group actions (hidden for Ungrouped) -->
      <NcDropdown v-if="!isDefaultGroup" v-model:visible="isGroupMenuOpen" :trigger="['click']">
        <NcButton
          type="text"
          size="xxsmall"
          class="!rounded-md flex-none"
          data-testid="nc-bookmark-group-kebab"
          @click.stop
        >
          <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted !w-3.5 !h-3.5" />
        </NcButton>
        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem
              data-testid="nc-bookmark-group-rename"
              @click="onRenameGroup"
            >
              <div v-e="['c:bookmark:group:rename']" class="flex gap-2 items-center">
                <GeneralIcon icon="rename" class="w-4 h-4" />
                {{ $t('general.rename') }}
              </div>
            </NcMenuItem>
            <NcMenuItem
              data-testid="nc-bookmark-group-delete"
              class="!text-nc-content-red-dark"
              @click="onDeleteGroup"
            >
              <div v-e="['c:bookmark:group:delete']" class="flex gap-2 items-center">
                <GeneralIcon icon="delete" class="w-4 h-4" />
                {{ $t('labels.deleteFolder') }}
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <!-- Bookmark items with drop indicators (hidden when collapsed) -->
    <template v-if="!isCollapsed">
      <div ref="listRef" class="flex flex-col">
        <template v-for="(bm, idx) in groupBookmarks" :key="bm.id">
          <!-- Drop indicator line before item -->
          <div
            v-if="localDropIndex === idx && bm.id !== draggingBookmarkId"
            class="h-0.5 mx-1.5 bg-nc-content-brand rounded-full"
          />

          <BookmarksItem
            :bookmark="bm"
            :groups="allGroups"
            @click="emit('navigate', bm)"
          />
        </template>

        <!-- Drop indicator line at end -->
        <div
          v-if="localDropIndex === groupBookmarks.length && groupBookmarks.length > 0"
          class="h-0.5 mx-1.5 bg-nc-content-brand rounded-full"
        />
      </div>

      <!-- Empty group drop target -->
      <div
        v-if="!groupBookmarks.length"
        class="text-xs text-nc-content-gray-muted px-1.5 py-1"
      >
        {{ $t('labels.noData') }}
      </div>
    </template>
  </div>
</template>
