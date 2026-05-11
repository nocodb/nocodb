<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

interface Props {
  bookmark: BookmarkType
  groups: BookmarkGroupType[]
  /** Render trailing breadcrumb on hover (List mode) */
  showCrumbOnHover?: boolean
  /** Density: compact = card-mode standard padding */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCrumbOnHover: true,
  compact: false,
})

const { bookmark, groups, showCrumbOnHover, compact } = toRefs(props)

const ctxMenuRef = ref<any>()

const { onDragStart, onDragEnd, draggingBookmarkId } = useBookmarkDnd()

const { isEditing, isBookmarkSelected, toggleBookmark } = useBookmarkEdit()

const { navigateToBookmark } = useBookmarks()

const isSelected = computed(() => isBookmarkSelected(bookmark.value.id!))

function onRowClick(e: MouseEvent) {
  if (isEditing.value) {
    toggleBookmark(bookmark.value.id!)
    return
  }

  // Same-tab nav and Cmd/Ctrl-click both route through navigateToBookmark.
  // It owns flyout-close signaling via onNavigated, so the parent component
  // doesn't have to chain a separate event for that.
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  navigateToBookmark(bookmark.value, { inNewTab: cmdOrCtrl })
}

const meta = computed(() => bookmark.value.meta ?? {})

const viewIcon = computed(() => {
  if (bookmark.value.target_type !== 'view') return null
  return getViewIcon(meta.value.view_type)
})

// Custom emoji icon configured on the underlying entity. Workspace and
// base have their own icon components and aren't emoji-driven.
const customEmoji = computed<string | undefined>(() => {
  switch (bookmark.value.target_type) {
    case 'table':
    case 'view':
    case 'document':
    case 'workflow':
    case 'script':
    case 'dashboard':
      return bookmark.value.icon || undefined
    default:
      return undefined
  }
})

const displayTitle = computed(() => bookmark.value.title ?? '')

const isDragging = computed(() => draggingBookmarkId.value === bookmark.value.id)

// Light human breadcrumb shown on hover, e.g. "marketing crm" or "customers · grid"
const crumb = computed(() => {
  const m = meta.value
  switch (bookmark.value.target_type) {
    case 'workspace':
      return 'workspace'
    case 'base':
      return 'base'
    case 'table':
      return m.base_name || 'table'
    case 'view':
      return m.table_name ? `${m.table_name} · view` : 'view'
    case 'document':
      return 'document'
    case 'workflow':
      return 'workflow'
    case 'script':
      return 'script'
    case 'dashboard':
      return 'dashboard'
    default:
      return ''
  }
})

function handleDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', bookmark.value.id!)
  onDragStart(bookmark.value)
}
</script>

<template>
  <div
    class="nc-bookmark-item group"
    :class="{
      'is-dragging': isDragging,
      'is-compact': compact,
      'is-editing': isEditing,
      'is-selected': isEditing && isSelected,
    }"
    data-testid="nc-bookmark-item"
    draggable="true"
    @click="onRowClick"
    @dragstart="handleDragStart"
    @dragend="onDragEnd"
    @contextmenu.prevent="ctxMenuRef?.open()"
  >
    <!-- Selection checkbox (edit mode) -->
    <NcCheckbox
      v-if="isEditing"
      :checked="isSelected"
      class="nc-bookmark-item-check"
      data-testid="nc-bookmark-item-checkbox"
      @click.stop
      @change="toggleBookmark(bookmark.id!)"
    />

    <!-- Icon -->
    <div class="nc-bookmark-item-ic">
      <GeneralWorkspaceIcon
        v-if="bookmark.target_type === 'workspace'"
        :workspace="{
          id: bookmark.target_id,
          title: displayTitle,
          meta: { ...meta, icon: bookmark.icon, iconType: bookmark.icon_type, color: bookmark.icon_color },
        }"
        size="small"
      />
      <GeneralProjectIcon v-else-if="bookmark.target_type === 'base'" :color="meta.icon_color" class="!text-base" />
      <LazyGeneralEmojiPicker v-else :emoji="customEmoji" size="small" :readonly="true">
        <template #default>
          <component
            :is="viewIcon?.icon || iconMap.grid"
            v-if="bookmark.target_type === 'view'"
            class="w-4 h-4"
            :style="{ color: viewIcon?.color }"
          />
          <component
            :is="iconMap.table"
            v-else-if="bookmark.target_type === 'table'"
            class="w-4 text-sm text-nc-content-gray-muted"
          />
          <GeneralIcon v-else-if="bookmark.target_type === 'document'" icon="ncFileText" class="w-4 h-4 !text-nc-gray-600/75" />
          <GeneralIcon v-else-if="bookmark.target_type === 'workflow'" icon="ncAutomation" class="w-4 h-4 !text-nc-gray-600/75" />
          <GeneralIcon v-else-if="bookmark.target_type === 'script'" icon="ncScript" class="w-4 h-4 !text-nc-gray-600/75" />
          <GeneralIcon v-else-if="bookmark.target_type === 'dashboard'" icon="dashboards" class="w-4 h-4 !text-nc-gray-600/75" />
        </template>
      </LazyGeneralEmojiPicker>
    </div>

    <!-- Title — fills remaining space; truncates -->
    <div class="nc-bookmark-item-title-wrap">
      <NcTooltip show-on-truncate-only :attrs="{ class: 'nc-bookmark-item-title truncate block' }">
        {{ displayTitle }}
      </NcTooltip>
    </div>

    <!-- Hover breadcrumb (List only) -->
    <span v-if="showCrumbOnHover && crumb" class="nc-bookmark-item-crumb opacity-0 hidden group-hover:(opacity-100 inline)">
      {{ crumb }}
    </span>

    <!-- Kebab + dropdown — kebab is the trigger, no wrapper around the row -->
    <BookmarksItemContextMenu ref="ctxMenuRef" :bookmark="bookmark" :groups="groups" class="opacity-0 group-hover:opacity-100" />
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-item {
  @apply flex items-center gap-2.5 px-2.5 py-0.5 min-h-8 rounded-md cursor-pointer relative min-w-0;
  @apply hover:bg-nc-bg-gray-light;

  &.is-dragging {
    @apply opacity-40;
  }
  &.is-compact {
    @apply gap-2 py-0.5 px-2;
  }
  &.is-selected {
    background: color-mix(in srgb, var(--nc-content-brand) 8%, transparent);
  }
}

.nc-bookmark-item-check {
  @apply flex-none ml-0.5;
}

.nc-bookmark-item-ic {
  @apply flex-none w-4 h-4 flex items-center justify-center;
}

.nc-bookmark-item-title-wrap {
  @apply flex-1 min-w-0;
}
.nc-bookmark-item-title-wrap :deep(.nc-bookmark-item-title) {
  @apply text-bodyDefaultSm text-nc-content-gray;
  font-weight: 450;
}

.nc-bookmark-item-crumb {
  @apply flex-none text-captionXs text-nc-content-gray-muted transition-opacity duration-150;
  font-family: 'JetBrainsMono', ui-monospace, monospace;
}

.nc-bookmark-item-kebab {
  @apply !rounded-md flex-none transition-opacity;
}
</style>
