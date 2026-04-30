<script setup lang="ts">
import type { BookmarkType } from 'nocodb-sdk'

interface Props {
  bookmark: BookmarkType
}

const props = defineProps<Props>()

const { bookmark } = toRefs(props)

const isHovering = ref(false)

const iconData = computed(() => {
  const meta = bookmark.value.meta ?? {}

  switch (bookmark.value.target_type) {
    case 'workspace':
      return {
        type: 'workspace',
        letter: (bookmark.value.title || 'W')[0].toUpperCase(),
        color: meta.icon_color || meta.color || '#7c3aed',
      }
    case 'base':
      return { type: 'base' }
    case 'table':
      return { type: 'table' }
    case 'view': {
      const viewTypeMap: Record<number, string> = {
        0: 'grid',
        1: 'form',
        2: 'gallery',
        3: 'grid', // default
        4: 'kanban',
        5: 'calendar',
      }
      return {
        type: 'view',
        viewType: viewTypeMap[meta.view_type] || 'grid',
      }
    }
    case 'document':
      return { type: 'document' }
    case 'workflow':
      return { type: 'workflow' }
    case 'script':
      return { type: 'script' }
    default:
      return { type: 'base' }
  }
})

const viewIconMap: Record<string, { icon: string; class: string }> = {
  grid: { icon: 'ncViewTypeGrid', class: 'text-blue-500' },
  form: { icon: 'ncViewTypeForm', class: 'text-purple-500' },
  gallery: { icon: 'ncViewTypeGallery', class: 'text-pink-500' },
  kanban: { icon: 'ncViewTypeKanban', class: 'text-amber-500' },
  calendar: { icon: 'ncViewTypeCalendar', class: 'text-red-500' },
}
</script>

<template>
  <div
    class="flex items-center gap-2.5 px-1.5 py-1 rounded-md cursor-pointer hover:bg-nc-bg-gray-light group"
    data-testid="nc-bookmark-item"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- Workspace pill -->
    <div
      v-if="iconData.type === 'workspace'"
      class="w-4.5 h-4.5 rounded-[5px] flex items-center justify-center text-white text-[10.5px] font-bold flex-shrink-0"
      :style="{ background: iconData.color }"
    >
      {{ iconData.letter }}
    </div>

    <!-- Base icon -->
    <GeneralIcon
      v-else-if="iconData.type === 'base'"
      icon="ncProject"
      class="w-4 h-4 text-nc-content-gray-subtle flex-shrink-0"
    />

    <!-- Table icon -->
    <GeneralIcon
      v-else-if="iconData.type === 'table'"
      icon="ncTable"
      class="w-4 h-4 text-nc-content-gray-subtle flex-shrink-0"
    />

    <!-- View icon -->
    <GeneralIcon
      v-else-if="iconData.type === 'view'"
      :icon="viewIconMap[iconData.viewType]?.icon || 'ncViewTypeGrid'"
      class="w-4 h-4 flex-shrink-0"
      :class="viewIconMap[iconData.viewType]?.class || 'text-blue-500'"
    />

    <!-- Document icon -->
    <GeneralIcon
      v-else-if="iconData.type === 'document'"
      icon="ncFileText"
      class="w-4 h-4 text-nc-content-gray-subtle flex-shrink-0"
    />

    <!-- Workflow icon -->
    <GeneralIcon
      v-else-if="iconData.type === 'workflow'"
      icon="ncAutomation"
      class="w-4 h-4 text-nc-content-gray-subtle flex-shrink-0"
    />

    <!-- Script icon -->
    <GeneralIcon
      v-else-if="iconData.type === 'script'"
      icon="ncScript"
      class="w-4 h-4 text-nc-content-gray-subtle flex-shrink-0"
    />

    <!-- Title -->
    <NcTooltip show-on-truncate-only class="truncate flex-1 text-small text-nc-content-gray">
      {{ bookmark.title }}
    </NcTooltip>

    <!-- Delete button on hover -->
    <NcButton
      v-show="isHovering"
      type="text"
      size="xxs"
      class="!h-5 !w-5 flex-shrink-0"
      @click.stop="$emit('delete', bookmark.id)"
    >
      <GeneralIcon icon="close" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
    </NcButton>
  </div>
</template>
