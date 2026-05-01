<script setup lang="ts">
import type { BookmarkType, BookmarkGroupType } from 'nocodb-sdk'

interface Props {
  bookmark: BookmarkType
  groups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { bookmark, groups } = toRefs(props)

const { onDragStart, onDragEnd, draggingBookmarkId } = useBookmarkDnd()

const meta = computed(() => bookmark.value.meta ?? {})

const viewIcon = computed(() => {
  if (bookmark.value.target_type !== 'view') return null
  return getViewIcon(meta.value.view_type)
})

const tableEmoji = computed(() => {
  if (bookmark.value.target_type !== 'table') return null
  return meta.value.icon || null
})

const displayTitle = computed(() => bookmark.value.title ?? bookmark.value.resolved_title ?? '')

const isDragging = computed(() => draggingBookmarkId.value === bookmark.value.id)

function handleDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', bookmark.value.id!)
  onDragStart(bookmark.value)
}
</script>

<template>
  <BookmarksItemContextMenu :bookmark="bookmark" :groups="groups">
    <template #default="{ open: openMenu, isOpen: menuIsOpen }">
      <div
        class="group flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-nc-bg-gray-light"
        :class="{ 'opacity-40': isDragging }"
        data-testid="nc-bookmark-item"
        draggable="true"
        @dragstart="handleDragStart"
        @dragend="onDragEnd"
      >
        <!-- Icon container — fixed size to prevent layout shift -->
        <div class="flex-none w-5 h-5 flex items-center justify-center">
          <!-- Workspace -->
          <GeneralWorkspaceIcon
            v-if="bookmark.target_type === 'workspace'"
            :workspace="{ id: bookmark.target_id, title: displayTitle, meta: meta }"
            size="small"
          />

          <!-- Base -->
          <GeneralProjectIcon
            v-else-if="bookmark.target_type === 'base'"
            :color="meta.icon_color"
            class="!text-base"
          />

          <!-- Table with custom emoji -->
          <template v-else-if="bookmark.target_type === 'table'">
            <LazyGeneralEmojiPicker
              v-if="tableEmoji"
              :emoji="tableEmoji"
              size="small"
              :readonly="true"
            >
              <template #default>
                <component :is="iconMap.table" class="w-4 text-sm text-nc-content-gray-muted" />
              </template>
            </LazyGeneralEmojiPicker>
            <component :is="iconMap.table" v-else class="w-4 text-sm text-nc-content-gray-muted" />
          </template>

          <!-- View -->
          <component
            :is="viewIcon?.icon || iconMap.grid"
            v-else-if="bookmark.target_type === 'view'"
            class="w-4 h-4"
            :style="{ color: viewIcon?.color }"
          />

          <!-- Document -->
          <GeneralIcon
            v-else-if="bookmark.target_type === 'document'"
            icon="ncFileText"
            class="w-4 h-4 text-nc-content-gray-subtle"
          />

          <!-- Workflow -->
          <GeneralIcon
            v-else-if="bookmark.target_type === 'workflow'"
            icon="ncAutomation"
            class="w-4 h-4 text-nc-content-gray-subtle"
          />

          <!-- Script -->
          <GeneralIcon
            v-else-if="bookmark.target_type === 'script'"
            icon="ncScript"
            class="w-4 h-4 text-nc-content-gray-subtle"
          />
        </div>

        <!-- Title -->
        <NcTooltip show-on-truncate-only class="truncate flex-1 text-small text-nc-content-gray">
          {{ displayTitle }}
        </NcTooltip>

        <!-- Kebab menu button (visible on hover) -->
        <NcButton
          type="text"
          size="xxsmall"
          class="!rounded-md opacity-0 group-hover:opacity-100 flex-none"
          :class="{ '!opacity-100': menuIsOpen }"
          data-testid="nc-bookmark-item-kebab"
          @click.stop="openMenu"
        >
          <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
        </NcButton>
      </div>
    </template>
  </BookmarksItemContextMenu>
</template>
