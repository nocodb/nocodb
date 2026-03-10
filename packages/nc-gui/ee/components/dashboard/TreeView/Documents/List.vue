<script setup lang="ts">
import Sortable from 'sortablejs'
import type { DocumentType } from 'nocodb-sdk'
import type { DocTreeNode } from '~/store/documents'

interface Props {
  baseId: string
}

const props = defineProps<Props>()
const { baseId } = toRefs(props)

const { isMobileMode } = useGlobal()
const { $e } = useNuxtApp()
const documentsStore = useDocumentsStore()
const { moveDocument } = documentsStore
const {
  activeDocumentId,
  documents: allDocuments,
  documentTree,
  expandedDocIds,
  isLoadingDocuments,
} = storeToRefs(documentsStore)

const baseDocuments = computed(() => allDocuments.value.get(baseId.value) ?? [])

// ── Flat visible nodes ─────────────────────────────────────────────
// Flatten the tree into a single ordered list (respecting collapse state).
// Single list eliminates cross-container SortableJS issues that cause duplicates.

interface FlatNode {
  doc: DocumentType
  depth: number
  hasChildren: boolean
}

const flatVisibleNodes = computed<FlatNode[]>(() => {
  const result: FlatNode[] = []

  const walk = (nodes: DocTreeNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0 || !!node.doc.has_children
      result.push({ doc: node.doc, depth, hasChildren })
      if (node.children.length > 0 && expandedDocIds.value.has(node.doc.id!)) {
        walk(node.children, depth + 1)
      }
    }
  }

  walk(documentTree.value, 0)
  return result
})

// ── Drag state ─────────────────────────────────────────────────────

const dragging = ref(false)
const listRef = useTemplateRef<HTMLElement>('listRef')

let sortable: Sortable | null = null
let draggedDocId: string | null = null
let draggedSubtreeIds: Set<string> | null = null

const INDENT_PX = 24
const BASE_INDENT_PX = 8

// ── Drop indicator + pending drop ──────────────────────────────────
// The blue line is the sole visual during drag (SortableJS ghost is hidden).
// `pendingDrop` stores the calculated target so `onEnd` can apply it.

const dropIndicator = reactive({
  visible: false,
  top: 0,
  depth: 0,
})

const pendingDrop = ref<{ targetParentId: string | null; order: number } | null>(null)

// ── Nesting helpers ────────────────────────────────────────────────

/**
 * Calculate the valid depth range at a drop slot.
 *
 * - maxDepth: prev item's depth + 1 (can nest under the item above)
 * - minDepth: next item's depth (must be at least as deep as item below)
 */
function getDepthRange(prevNode: FlatNode | undefined, nextNode: FlatNode | undefined): { min: number; max: number } {
  const maxDepth = prevNode ? prevNode.depth + 1 : 0
  const minDepth = nextNode ? nextNode.depth : 0
  return { min: minDepth, max: maxDepth }
}

/**
 * Get the non-dragged items with their bounding rects for slot calculation.
 * Items don't shift during drag (onMove returns false), so rects are stable.
 * Excludes the dragged item AND its descendants to prevent self-nesting.
 */
function getVisibleEntries(el: HTMLElement, nodes: FlatNode[]) {
  const nodeMap = new Map(nodes.map((n) => [n.doc.id, n]))
  const items = Array.from(el.querySelectorAll<HTMLElement>(':scope > .nc-document-item'))
  const entries: { node: FlatNode; rect: DOMRect }[] = []

  for (const item of items) {
    const id = item.dataset.id
    if (id === draggedDocId) continue
    if (id && draggedSubtreeIds?.has(id)) continue
    const node = nodeMap.get(id)
    if (node) {
      entries.push({ node, rect: item.getBoundingClientRect() })
    }
  }

  return entries
}

/**
 * From cursor Y, find which slot (gap between items) the cursor is in.
 * Returns the index in `entries` where the item would be inserted BEFORE.
 * Also returns the Y position for the indicator line.
 */
function findSlot(entries: { node: FlatNode; rect: DOMRect }[], clientY: number, listTop: number) {
  let slotIndex = entries.length
  let indicatorY = 0

  for (let i = 0; i < entries.length; i++) {
    const { rect } = entries[i]
    if (clientY < rect.top + rect.height / 2) {
      slotIndex = i
      indicatorY = rect.top - listTop
      break
    }
    indicatorY = rect.bottom - listTop
  }

  return { slotIndex, indicatorY }
}

/**
 * Calculate the full drop target: parent, order, and depth.
 */
function calculateDropTarget(entries: { node: FlatNode; rect: DOMRect }[], slotIndex: number, cursorDepth: number) {
  const prev = slotIndex > 0 ? entries[slotIndex - 1].node : undefined
  const next = slotIndex < entries.length ? entries[slotIndex].node : undefined

  // Clamp cursor depth to valid range
  const { min, max } = getDepthRange(prev, next)
  const targetDepth = Math.max(min, Math.min(max, cursorDepth))

  // Find parent: walk backwards to find ancestor at targetDepth - 1
  let targetParentId: string | null = null
  if (targetDepth > 0) {
    for (let i = slotIndex - 1; i >= 0; i--) {
      if (entries[i].node.depth === targetDepth - 1) {
        targetParentId = entries[i].node.doc.id!
        break
      }
    }
  }

  // Calculate order between prev/next siblings at same depth + parent
  let prevSiblingOrder: number | null = null
  let nextSiblingOrder: number | null = null

  for (let i = slotIndex - 1; i >= 0; i--) {
    const n = entries[i].node
    if (n.depth < targetDepth) break
    if (n.depth === targetDepth && (n.doc.parent_id ?? null) === targetParentId) {
      prevSiblingOrder = n.doc.order ?? 0
      break
    }
  }

  for (let i = slotIndex; i < entries.length; i++) {
    const n = entries[i].node
    if (n.depth < targetDepth) break
    if (n.depth === targetDepth && (n.doc.parent_id ?? null) === targetParentId) {
      nextSiblingOrder = n.doc.order ?? 0
      break
    }
  }

  let order: number
  if (prevSiblingOrder === null && nextSiblingOrder === null) order = 1
  else if (nextSiblingOrder === null) order = prevSiblingOrder! + 1
  else if (prevSiblingOrder === null) order = nextSiblingOrder / 2
  else order = (prevSiblingOrder + nextSiblingOrder) / 2

  return { targetDepth, targetParentId, order }
}

// ── Drag-over handler ──────────────────────────────────────────────
// Runs on every pointer move during drag. Updates the blue indicator
// line and pre-calculates the drop target for onEnd.

function onDragOver(e: DragEvent) {
  if (!dragging.value || !draggedDocId || e.clientX <= 0) return

  const el = listRef.value
  if (!el) return

  const listRect = el.getBoundingClientRect()
  const entries = getVisibleEntries(el, flatVisibleNodes.value)
  const { slotIndex, indicatorY } = findSlot(entries, e.clientY, listRect.top)

  // Depth from cursor X position
  const relativeX = e.clientX - listRect.left
  const cursorDepth = Math.max(0, Math.round((relativeX - BASE_INDENT_PX) / INDENT_PX))

  const { targetDepth, targetParentId, order } = calculateDropTarget(entries, slotIndex, cursorDepth)

  // Update indicator
  dropIndicator.visible = true
  dropIndicator.top = indicatorY
  dropIndicator.depth = targetDepth

  // Store for onEnd
  pendingDrop.value = { targetParentId, order }
}

// ── Sortable init ──────────────────────────────────────────────────

const initSortable = (el: HTMLElement) => {
  if (isMobileMode.value) return
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el, {
    draggable: '.nc-document-item',
    ghostClass: 'nc-doc-ghost',
    chosenClass: 'nc-doc-chosen',
    // Prevent SortableJS from shifting items — the blue indicator line
    // is the sole visual. This avoids DOM/VDOM conflicts entirely.
    onMove: () => false,
    filter: isTouchEvent,
    onStart: (evt: Sortable.SortableEvent) => {
      dragging.value = true
      draggedDocId = (evt.item as HTMLElement).dataset.id || null
      pendingDrop.value = null

      // Collect all descendant IDs to prevent self-nesting during drag
      if (draggedDocId) {
        draggedSubtreeIds = new Set<string>()
        const collectDescendants = (parentId: string) => {
          for (const d of baseDocuments.value) {
            if (d.parent_id === parentId && d.id) {
              draggedSubtreeIds!.add(d.id)
              collectDescendants(d.id)
            }
          }
        }
        collectDescendants(draggedDocId)
      }
    },
    onEnd: async () => {
      dragging.value = false
      dropIndicator.visible = false

      const docId = draggedDocId
      draggedDocId = null
      draggedSubtreeIds = null

      if (!docId || !pendingDrop.value) return

      const { targetParentId, order } = pendingDrop.value
      pendingDrop.value = null

      // Skip if nothing changed
      const currentDoc = baseDocuments.value.find((d) => d.id === docId)
      if (currentDoc && (currentDoc.parent_id ?? null) === targetParentId && currentDoc.order === order) {
        return
      }

      await moveDocument(baseId.value, docId, targetParentId, order)
      $e('a:document:reorder')
    },
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })

  el.addEventListener('dragover', onDragOver)
}

watchEffect(() => {
  if (listRef.value) {
    initSortable(listRef.value)
  }
})

onBeforeUnmount(() => {
  if (sortable) sortable.destroy()
  if (listRef.value) {
    listRef.value.removeEventListener('dragover', onDragOver)
  }
})
</script>

<template>
  <div data-testid="nc-docs-sidebar-pages-list">
    <!-- Loading skeleton for initial docs load -->
    <DashboardTreeViewProjectListSkeletonEntity v-if="!baseDocuments.length && isLoadingDocuments" class="!px-2.5 mt-2" />

    <!-- Empty state: no documents yet -->
    <div v-else-if="!baseDocuments.length" class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal">
      {{ $t('labels.noDocuments') }}
    </div>

    <!-- Flat document list — blue indicator line as the sole drag visual -->
    <div
      v-if="flatVisibleNodes.length"
      ref="listRef"
      class="nc-documents-menu flex flex-col w-full !border-r-0 bg-nc-bg-gray-sidebar relative"
    >
      <!-- Drop indicator line (Notion-style) -->
      <div
        v-show="dropIndicator.visible && dragging"
        class="nc-doc-drop-indicator absolute pointer-events-none z-10"
        :style="{
          top: `${dropIndicator.top}px`,
          left: `${BASE_INDENT_PX + dropIndicator.depth * INDENT_PX}px`,
          right: '8px',
        }"
      />

      <DashboardTreeViewDocumentsNode
        v-for="node of flatVisibleNodes"
        :key="node.doc.id"
        :data-id="node.doc.id"
        :data-order="node.doc.order"
        :data-title="node.doc.title"
        :doc="node.doc"
        :depth="node.depth"
        :has-children="node.hasChildren"
        class="nc-document-item nc-tree-item !rounded-md !pr-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        :class="{
          active: activeDocumentId === node.doc.id,
        }"
      />
    </div>
  </div>
</template>

<style lang="scss">
.nc-documents-menu {
  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }

  // Ghost hidden — onMove returns false so it stays at original position.
  // We hide it and use the blue indicator line instead.
  .nc-doc-ghost {
    @apply !h-0 !min-h-0 !max-h-0 !p-0 !m-0 !border-0 !opacity-0 overflow-hidden;
  }

  .nc-doc-chosen {
    @apply opacity-40;
  }
}

// Blue indicator line with dot — standard tree drag-and-drop visual
.nc-doc-drop-indicator {
  height: 2px;
  @apply bg-nc-content-brand rounded-full;

  &::before {
    content: '';
    @apply absolute w-2 h-2 rounded-full bg-nc-content-brand -top-0.75;
    left: -3px;
  }
}
</style>
