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

const { removeGroup } = useBookmarks()

const { $e } = useNuxtApp()

const {
  hoverGroupId,
  dropIndex,
  draggingBookmarkId,
  onDragEnterGroup,
  onDragLeaveGroup,
  onDropOnGroup,
  updateDropIndex,
} = useBookmarkDnd()

const isGroupMenuOpen = ref(false)

const listRef = ref<HTMLElement>()

const isDefaultGroup = computed(() => group.value.name === 'Ungrouped')

const isDropTarget = computed(() => hoverGroupId.value === group.value.id)

const localDropIndex = computed(() => {
  if (!isDropTarget.value) return null
  return dropIndex.value
})

async function onDeleteGroup() {
  await removeGroup(group.value.id!)
  $e('a:bookmark:group:delete')
  isGroupMenuOpen.value = false
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  // Calculate drop index from cursor Y position relative to items
  if (!listRef.value) return

  const items = listRef.value.querySelectorAll('[data-testid="nc-bookmark-item"]')
  let idx = groupBookmarks.value.length

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect()
    const midY = rect.top + rect.height / 2

    if (e.clientY < midY) {
      // Skip if dragging this exact item (don't show indicator on itself)
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
  onDragEnterGroup(group.value.id!)
}
</script>

<template>
  <div
    class="flex flex-col gap-0.5 rounded-lg transition-colors"
    :class="{ 'bg-nc-bg-brand-light/40': isDropTarget }"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="onDragLeaveGroup(group.id!)"
    @drop.prevent="onDropOnGroup(group.id!)"
  >
    <!-- Group title row -->
    <div class="group/header flex items-center justify-between px-1.5 mb-1.5">
      <span class="text-[11px] font-semibold text-nc-content-gray-subtle">
        {{ group.name }}
      </span>

      <!-- Group delete action (hidden for Ungrouped) -->
      <NcDropdown v-if="!isDefaultGroup" v-model:visible="isGroupMenuOpen" :trigger="['click']">
        <NcButton
          type="text"
          size="xxsmall"
          class="!rounded-md opacity-0 group-hover/header:opacity-100 flex-none"
          :class="{ '!opacity-100': isGroupMenuOpen }"
          data-testid="nc-bookmark-group-kebab"
          @click.stop
        >
          <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted !w-3.5 !h-3.5" />
        </NcButton>
        <template #overlay>
          <NcMenu variant="small">
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

    <!-- Bookmark items with drop indicators -->
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
  </div>
</template>
