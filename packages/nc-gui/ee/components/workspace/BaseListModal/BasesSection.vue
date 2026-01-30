<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'
import Sortable, { type SortableEvent } from 'sortablejs'

type SectionType = 'starred' | 'private' | 'owned' | 'managed' | 'default'

const props = defineProps<{
  type: SectionType
  bases: NcProject[]
  // Functions to check if a base has starred/private attributes
  // Used to show indicator icons when base is displayed in a lower-priority section
  isBaseStarred?: (base: NcProject) => boolean
  isBasePrivate?: (base: NcProject) => boolean
}>()

const emit = defineEmits<{
  select: [base: NcProject]
  reorder: [baseId: string, newOrder: number]
  rename: [base: NcProject, title: string]
  toggleStarred: [baseId: string]
  duplicate: [base: NcProject]
  openErd: [base: NcProject, source: SourceType]
  openSettings: [baseId: string]
  delete: [base: NcProject]
  updateColor: [base: NcProject, color: string]
}>()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const gridRef = useTemplateRef('gridRef')

const dragging = ref(false)

const isMarked = ref<string | false>(false)

let sortable: Sortable | null = null

// Create bases by ID lookup for efficient access during drag
const basesById = computed(() =>
  props.bases.reduce<Record<string, NcProject>>((acc, base) => {
    acc[base.id!] = base
    return acc
  }, {}),
)

const sectionConfig = computed(() => {
  switch (props.type) {
    case 'starred':
      return {
        icon: 'star',
        label: t('general.starred'),
      }
    case 'owned':
      return {
        icon: 'ncUser',
        label: t('activity.ownedByMe'),
      }
    case 'private':
      return {
        icon: 'ncLock',
        label: t('general.private'),
      }
    case 'managed':
      return {
        icon: 'ncBox',
        label: t('labels.managed'),
      }
    default:
      return {
        icon: 'ncFolder',
        label: t('objects.projects'),
      }
  }
})

const canReorder = computed(() => {
  return !isMobileMode.value && isUIAllowed('baseReorder') && props.bases.length > 1
})

// Determine if indicator icons should be shown based on section type
// Starred section: No indicators (highest priority)
// Private section: Show star indicator if base is starred
// Other sections: Show both star and private indicators if applicable
const shouldShowStarIndicator = (base: NcProject) => {
  if (props.type === 'starred') return false
  return props.isBaseStarred?.(base) ?? false
}

const shouldShowPrivateIndicator = (base: NcProject) => {
  if (props.type === 'private') return false
  return props.isBasePrivate?.(base) ?? false
}

/** Briefly highlight an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

const initSortable = (el: Element) => {
  if (isMobileMode.value || !isUIAllowed('baseReorder')) return
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el as HTMLElement, {
    ghostClass: 'ghost',
    chosenClass: 'chosen',
    dragClass: 'dragging',
    animation: 150,
    revertOnSpill: true,
    filter: isTouchEvent,
    onStart: (evt: SortableEvent) => {
      evt.stopImmediatePropagation()
      dragging.value = true
    },
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      evt.stopImmediatePropagation()
      dragging.value = false

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLElement
      const item = basesById.value[itemEl.dataset.id as string]

      if (!item) return

      // Get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // Skip if children count is 1
      if (children.length < 2) return

      // Get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      // Get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && basesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && basesById.value[itemAfterEl.dataset.id as string]

      let newOrder: number

      // Calculate new order using fractional ordering
      if (children.length - 1 === newIndex) {
        // Item moved to last position
        newOrder = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        // Item moved to first position
        newOrder = (itemAfter?.order ?? 1) / 2
      } else {
        // Item moved to middle position
        newOrder = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      // Emit reorder event to parent
      emit('reorder', item.id!, newOrder)
      markItem(item.id!)
    },
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
}

const onSelectBase = (base: NcProject) => {
  emit('select', base)
}

watchEffect(() => {
  if (gridRef.value && canReorder.value) {
    initSortable(gridRef.value)
  }
})

onBeforeUnmount(() => {
  if (sortable) {
    sortable.destroy()
    sortable = null
  }
})
</script>

<template>
  <div v-if="bases.length" class="nc-bases-section mb-6">
    <div class="flex items-center gap-2 mb-4 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
      <GeneralIcon :icon="sectionConfig.icon" class="w-3.5 h-3.5" />
      <span>{{ sectionConfig.label }}</span>
    </div>
    <div ref="gridRef" class="nc-bases-grid grid grid-cols-3 gap-3" :class="{ dragging }">
      <WorkspaceBaseListModalBaseNode
        v-for="base in bases"
        :key="base.id"
        :data-id="base.id"
        :data-order="base.order"
        :base="base"
        :is-starred="type === 'starred'"
        :is-private="type === 'private'"
        :is-marked="isMarked === base.id"
        :show-star-indicator="shouldShowStarIndicator(base)"
        :show-private-indicator="shouldShowPrivateIndicator(base)"
        @select="onSelectBase"
        @rename="(b, title) => emit('rename', b, title)"
        @toggle-starred="(id) => emit('toggleStarred', id)"
        @duplicate="(b) => emit('duplicate', b)"
        @open-erd="(b, source) => emit('openErd', b, source)"
        @open-settings="(id) => emit('openSettings', id)"
        @delete="(b) => emit('delete', b)"
        @update-color="(b, color) => emit('updateColor', b, color)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-bases-grid {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  .ghost {
    @apply !bg-nc-bg-gray-medium !opacity-50 !border-nc-border-brand;
  }

  .chosen {
    @apply !opacity-100;
  }

  &.dragging {
    cursor: grabbing;
  }
}
</style>
