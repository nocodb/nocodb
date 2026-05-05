<script setup lang="ts">
import type { BookmarkType, BookmarkGroupType } from 'nocodb-sdk'

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

const emit = defineEmits<{ click: [] }>()

const ctxMenuRef = ref<any>()

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
    }"
    data-testid="nc-bookmark-item"
    draggable="true"
    @click="emit('click')"
    @dragstart="handleDragStart"
    @dragend="onDragEnd"
    @contextmenu.prevent="ctxMenuRef?.open()"
  >
    <!-- Icon -->
    <div class="nc-bookmark-item-ic">
      <GeneralWorkspaceIcon
        v-if="bookmark.target_type === 'workspace'"
        :workspace="{ id: bookmark.target_id, title: displayTitle, meta: meta }"
        size="small"
      />
      <GeneralProjectIcon v-else-if="bookmark.target_type === 'base'" :color="meta.icon_color" class="!text-base" />
      <template v-else-if="bookmark.target_type === 'table'">
        <LazyGeneralEmojiPicker v-if="tableEmoji" :emoji="tableEmoji" size="small" :readonly="true">
          <template #default>
            <component :is="iconMap.table" class="w-4 text-sm text-nc-content-gray-muted" />
          </template>
        </LazyGeneralEmojiPicker>
        <component :is="iconMap.table" v-else class="w-4 text-sm text-nc-content-gray-muted" />
      </template>
      <component
        :is="viewIcon?.icon || iconMap.grid"
        v-else-if="bookmark.target_type === 'view'"
        class="w-4 h-4"
        :style="{ color: viewIcon?.color }"
      />
      <GeneralIcon v-else-if="bookmark.target_type === 'document'" icon="ncFileText" class="w-4 h-4 !text-nc-gray-600/75" />
      <GeneralIcon v-else-if="bookmark.target_type === 'workflow'" icon="ncAutomation" class="w-4 h-4 !text-nc-gray-600/75" />
      <GeneralIcon v-else-if="bookmark.target_type === 'script'" icon="ncScript" class="w-4 h-4 !text-nc-gray-600/75" />
      <GeneralIcon v-else-if="bookmark.target_type === 'dashboard'" icon="dashboards" class="w-4 h-4 !text-nc-gray-600/75" />
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
  @apply flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer relative min-w-0;
  @apply hover:bg-nc-bg-gray-light;

  &.is-dragging {
    @apply opacity-40;
  }
  &.is-compact {
    @apply gap-2 py-1 px-2;
  }
}

.nc-bookmark-item-ic {
  @apply flex-none w-5 h-5 flex items-center justify-center;
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
