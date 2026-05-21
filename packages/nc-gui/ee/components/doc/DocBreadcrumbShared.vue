<script setup lang="ts">
import type { DocumentType, PublicDocTreeNode } from 'nocodb-sdk'

// Breadcrumb for the public-share doc reader. Mirrors the in-app
// DocBreadcrumb shape (share-root → middle → parent → current, with the
// >2-ancestor ellipsis) but reads ancestors / siblings / children out of
// the share-scope tree we already hold in `meta.tree` instead of going
// through useDocumentsStore. DocBreadcrumbSegment + DocBreadcrumbMenuRow
// are agnostic to where the items come from — we just shim the share
// tree's PublicDocTreeNode shape to DocumentType so the same components
// can render it.
interface Props {
  uuid: string
  rootNode: PublicDocTreeNode | null | undefined
  activeDocId: string | null | undefined
  /** Optional override for the current-page icon (e.g. the freshly
   *  loaded /content.icon, which lands sooner than the tree update). */
  activeIcon?: string | null
  /** Optional override for the current-page title — same reason. */
  activeTitle?: string
  tree: PublicDocTreeNode[]
  loadChildren: (uuid: string, parentDocId: string) => Promise<void> | void
  /** Mirrors the share's include_subtree flag — when false, descendants are
   *  not part of the share scope so the breadcrumb must not expose any
   *  child-submenu affordances. */
  includeSubtree?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  activeIcon: null,
  activeTitle: '',
  includeSubtree: true,
})

const emit = defineEmits<{
  select: [docId: string]
}>()

const { t } = useI18n()
const { isRtl } = useRtl()

const ellipsisPlacement = computed(() => (isRtl.value ? 'bottomRight' : 'bottomLeft'))
const depthIcon = computed(() => (isRtl.value ? 'ncCornerDownLeft' : 'ncCornerDownRight'))
const depthIconClass = computed(() => (isRtl.value ? 'mr-1 -ml-0.5' : 'ml-1 -mr-0.5'))

const nodesById = computed(() => {
  const m = new Map<string, PublicDocTreeNode>()
  for (const n of props.tree) m.set(n.id, n)
  return m
})

// PublicDocTreeNode → DocumentType-shape adapter. DocBreadcrumbSegment +
// DocBreadcrumbMenuRow only read id, title, meta?.icon, parent_id, order,
// and has_children, so this minimal shim keeps the existing components
// untouched.
// When the subtree isn't shared, descendants aren't fetched and aren't
// navigable — force has_children to false so DocBreadcrumbMenuRow doesn't
// render the submenu chevron + try to lazy-load children that will never
// arrive.
const toShim = (node: PublicDocTreeNode): DocumentType => ({
  id: node.id,
  title: node.title,
  meta: node.icon ? { icon: node.icon } : {},
  parent_id: node.parent_id,
  order: node.order,
  has_children: props.includeSubtree && node.has_children,
})

// Ancestors of the active doc — share-root → parent, excludes the active
// doc itself. Walk parent_id upward until we hit the re-anchored null
// (share root). Bounded to defend against malformed cycles.
const ancestors = computed<PublicDocTreeNode[]>(() => {
  if (!props.activeDocId || !props.rootNode) return []
  if (props.activeDocId === props.rootNode.id) return []

  const chain: PublicDocTreeNode[] = []
  const active = nodesById.value.get(props.activeDocId)
  let cursor: string | null = active?.parent_id ?? null
  let depth = 0
  while (cursor && depth < 64) {
    const node = nodesById.value.get(cursor)
    if (!node) break
    chain.unshift(node)
    cursor = node.parent_id ?? null
    depth += 1
  }
  return chain
})

const rootAncestor = computed(() => ancestors.value[0] ?? null)
const parentAncestor = computed(() =>
  ancestors.value.length > 1 ? ancestors.value[ancestors.value.length - 1] : null,
)
const middleAncestor = computed(() => (ancestors.value.length === 3 ? ancestors.value[1] : null))
const collapsedMiddle = computed(() => (ancestors.value.length <= 3 ? [] : ancestors.value.slice(1, -1)))
const hasCollapsed = computed(() => collapsedMiddle.value.length > 0)

const displayTitle = computed(() => {
  if (props.activeTitle) return props.activeTitle
  if (props.activeDocId) {
    const node = nodesById.value.get(props.activeDocId)
    if (node) return node.title || t('general.untitled')
  }
  return t('general.untitled')
})

const displayIcon = computed<string | null>(() => {
  if (props.activeIcon) return props.activeIcon
  if (props.activeDocId) {
    return nodesById.value.get(props.activeDocId)?.icon ?? null
  }
  return null
})

const activePathIds = computed<string[]>(() => {
  const ids = ancestors.value.map((a) => a.id)
  if (props.activeDocId) ids.push(props.activeDocId)
  return ids
})

const getSiblingsByParent = (parentId: string | null | undefined): DocumentType[] => {
  const target = parentId ?? null
  return props.tree
    .filter((n) => (n.parent_id ?? null) === target)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(toShim)
}

const getChildren = (docId: string): DocumentType[] => {
  if (!props.includeSubtree) return []
  return props.tree
    .filter((n) => n.parent_id === docId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(toShim)
}

// DocBreadcrumbMenuRow calls loadChildren(docId) — bind the share uuid
// here so the menu rows don't need to know about it.
const ensureChildrenLoaded = (docId: string) => {
  if (!props.uuid) return
  return props.loadChildren(props.uuid, docId)
}

const rootSiblings = computed(() => (rootAncestor.value ? getSiblingsByParent(rootAncestor.value.parent_id) : []))
const middleSiblings = computed(() => (middleAncestor.value ? getSiblingsByParent(middleAncestor.value.parent_id) : []))
const parentSiblings = computed(() => (parentAncestor.value ? getSiblingsByParent(parentAncestor.value.parent_id) : []))
const currentSiblings = computed(() => {
  if (!props.activeDocId) return []
  const active = nodesById.value.get(props.activeDocId)
  if (!active) return []
  const siblings = getSiblingsByParent(active.parent_id)
  // Suppress the segment dropdown when there's nothing useful to navigate to:
  // the only sibling is the active doc itself AND its children aren't
  // navigable (subtree not shared OR the doc is a leaf). Otherwise the
  // chevron opens a dropdown containing just the current page with no
  // actionable submenu, which looks broken.
  if (siblings.length <= 1) {
    const only = siblings[0]
    if (!only || only.id === props.activeDocId) {
      if (!props.includeSubtree || !active.has_children) return []
    }
  }
  return siblings
})

const isEllipsisOpen = ref(false)

const collapsedDropdownItems = computed<NcListItemType[]>(() =>
  collapsedMiddle.value.map((ancestor, index) => ({
    value: ancestor.id,
    label: ancestor.title || t('general.untitled'),
    ncIcon: ancestor.icon ?? null,
    ncDepth: index,
  })),
)

const navigateToDoc = (doc: DocumentType) => {
  if (!doc.id) return
  emit('select', doc.id)
}

const handleEllipsisSelect = (option: NcListItemType) => {
  emit('select', option.value as string)
  isEllipsisOpen.value = false
}
</script>

<template>
  <div class="nc-shared-doc-breadcrumb flex items-center min-w-0 w-full" data-testid="nc-shared-doc-breadcrumb">
    <!-- Share root — first segment, present whenever the active doc has
         any ancestor (i.e. active is not the root). Click opens a
         dropdown with the root itself + submenus for its descendants. -->
    <template v-if="rootAncestor">
      <DocBreadcrumbSegment
        :label="rootAncestor.title || $t('general.untitled')"
        :icon-emoji="rootAncestor.icon ?? null"
        :items="rootSiblings"
        :active-ids="activePathIds"
        nested
        :get-children="getChildren"
        :load-children="ensureChildrenLoaded"
        @select="navigateToDoc"
      />
      <GeneralIcon icon="ncSlash1" class="nc-shared-doc-breadcrumb-divider" />
    </template>

    <!-- Single middle ancestor inline (exactly 3 ancestors: root, middle, parent) -->
    <template v-if="middleAncestor">
      <DocBreadcrumbSegment
        :label="middleAncestor.title || $t('general.untitled')"
        :icon-emoji="middleAncestor.icon ?? null"
        :items="middleSiblings"
        :active-ids="activePathIds"
        nested
        :get-children="getChildren"
        :load-children="ensureChildrenLoaded"
        @select="navigateToDoc"
      />
      <GeneralIcon icon="ncSlash1" class="nc-shared-doc-breadcrumb-divider" />
    </template>

    <!-- Ellipsis dropdown for many collapsed middle ancestors (mirrors in-app) -->
    <template v-if="hasCollapsed">
      <NcDropdown v-model:visible="isEllipsisOpen" :placement="ellipsisPlacement">
        <div
          class="nc-doc-breadcrumb-segment rounded-lg h-8 px-2 flex items-center gap-1 cursor-pointer text-nc-content-inverted-secondary font-weight-500 hover:(bg-nc-bg-gray-light text-nc-content-gray-emphasis)"
          @click.stop="isEllipsisOpen = !isEllipsisOpen"
        >
          ...
        </div>
        <template #overlay>
          <NcList
            v-model:open="isEllipsisOpen"
            :list="collapsedDropdownItems"
            :show-search-always="collapsedDropdownItems.length > 4"
            :search-input-placeholder="$t('general.search')"
            variant="medium"
            class="!w-64"
            @change="handleEllipsisSelect"
          >
            <template #listItem="{ option }">
              <div class="flex items-center gap-2 truncate">
                <GeneralIcon
                  v-if="option.ncDepth > 0"
                  :icon="depthIcon"
                  class="flex-none text-nc-content-gray-muted !w-3 !h-3"
                  :class="depthIconClass"
                />
                <LazyGeneralEmojiPicker v-if="option.ncIcon" :emoji="option.ncIcon" readonly size="xsmall" />
                <GeneralIcon v-else icon="ncFileText" class="flex-none text-nc-content-gray-muted !w-4 !h-4" />
                <NcTooltip class="truncate" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>
              </div>
            </template>
          </NcList>
        </template>
      </NcDropdown>
      <GeneralIcon icon="ncSlash1" class="nc-shared-doc-breadcrumb-divider" />
    </template>

    <!-- Parent ancestor -->
    <template v-if="parentAncestor">
      <DocBreadcrumbSegment
        :label="parentAncestor.title || $t('general.untitled')"
        :icon-emoji="parentAncestor.icon ?? null"
        :items="parentSiblings"
        :active-ids="activePathIds"
        nested
        :get-children="getChildren"
        :load-children="ensureChildrenLoaded"
        @select="navigateToDoc"
      />
      <GeneralIcon icon="ncSlash1" class="nc-shared-doc-breadcrumb-divider" />
    </template>

    <!-- Current page — always rendered. When active doc IS the share root,
         this is the only segment shown (matches in-app: base + current). -->
    <DocBreadcrumbSegment
      :label="displayTitle"
      :icon-emoji="displayIcon"
      :items="currentSiblings"
      :active-ids="activePathIds"
      max-width-class="max-w-1/2"
      nested
      :get-children="getChildren"
      :load-children="ensureChildrenLoaded"
      @select="navigateToDoc"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-shared-doc-breadcrumb-divider {
  @apply mx-0.5 flex-none text-nc-content-gray-muted/80 !stroke-transparent;
}
</style>
