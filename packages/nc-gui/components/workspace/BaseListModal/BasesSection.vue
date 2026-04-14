<script lang="ts" setup>
import Sortable, { type SortableEvent } from 'sortablejs'

type SectionType = 'starred' | 'private' | 'owned' | 'managed' | 'default'

const props = defineProps<{
  type: SectionType
  bases: NcProject[]
  isFilterApplied: boolean
  // Functions to check if a base has starred/private attributes
  // Used to show indicator icons when base is displayed in a lower-priority section
  isBaseStarred?: (base: NcProject) => boolean
  isBasePrivate?: (base: NcProject) => boolean
}>()

const { isFilterApplied } = toRefs(props)

const { t } = useI18n()
const { isUIAllowed } = useRoles()
const { isMobileMode } = useGlobal()

// Get reorder action from provider
const { onReorder } = useWsBaseListActionsOrThrow()

const gridRef = useTemplateRef('gridRef')
const dragging = ref(false)
const isMarked = ref<string | false>(false)

let sortable: Sortable | null = null

// Section configuration - using object map instead of switch
const sectionConfigs: Record<SectionType, { icon: string; labelKey: string }> = {
  starred: { icon: 'star', labelKey: 'general.starred' },
  owned: { icon: 'ncUser', labelKey: 'activity.ownedByMe' },
  private: { icon: 'ncLock', labelKey: 'general.private' },
  managed: { icon: 'ncBox', labelKey: 'labels.managed' },
  default: { icon: 'ncList', labelKey: 'general.all' },
}

const sectionConfig = computed(() => {
  const config = sectionConfigs[props.type]
  return {
    icon: config.icon,
    label: t(config.labelKey),
  }
})

// Create bases by ID lookup for efficient access during drag
const basesById = computed(() =>
  props.bases.reduce<Record<string, NcProject>>((acc, base) => {
    acc[base.id!] = base
    return acc
  }, {}),
)

const canReorder = computed(() => {
  return !isMobileMode.value && isUIAllowed('baseReorder') && props.bases.length > 1
})

// Determine if indicator icons should be shown based on section type
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

      const children: HTMLCollection = evt.to.children

      if (children.length < 2) return

      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      const itemBefore = itemBeforeEl && basesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && basesById.value[itemAfterEl.dataset.id as string]

      let newOrder: number

      // Calculate new order using fractional ordering
      if (children.length - 1 === newIndex) {
        newOrder = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        newOrder = (itemAfter?.order ?? 1) / 2
      } else {
        newOrder = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      onReorder(item, newOrder)
      markItem(item.id!)
    },
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
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
  <div v-if="bases.length || isFilterApplied" class="nc-bases-section mb-6" style="container-type: inline-size">
    <div class="flex items-center gap-2 mb-4 text-xs font-medium text-nc-content-gray-muted capitalize tracking-wide">
      <GeneralIcon
        :icon="sectionConfig.icon"
        class="w-3.5 h-3.5"
        :class="type === 'starred' ? 'nc-starred-icon text-nc-content-yellow-dark' : ''"
      />
      <span>{{ sectionConfig.label }}</span>
    </div>
    <div v-if="bases.length" ref="gridRef" class="nc-bases-grid grid grid-cols-1 gap-3" :class="{ dragging }">
      <WorkspaceBaseListModalBaseNode
        v-for="base in bases"
        :key="base.id"
        :data-id="base.id"
        :data-order="base.order"
        :base="base"
        :is-marked="isMarked === base.id"
        :show-star-indicator="shouldShowStarIndicator(base)"
        :show-private-indicator="shouldShowPrivateIndicator(base)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-starred-icon {
  :deep(path) {
    fill: currentColor;
  }
}

.nc-bases-grid {
  // Fallback for browsers without container query support
  @supports not (container-type: inline-size) {
    @media (min-width: 540px) {
      @apply grid-cols-2;
    }

    @media (min-width: 1024px) {
      @apply grid-cols-3;
    }

    @media (min-width: 1440px) {
      @apply grid-cols-4;
    }
  }

  @container (min-width: 540px) {
    @apply grid-cols-2;
  }

  @container (min-width: 820px) {
    @apply grid-cols-3;
  }

  @container (min-width: 1140px) {
    @apply grid-cols-4;
  }

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
