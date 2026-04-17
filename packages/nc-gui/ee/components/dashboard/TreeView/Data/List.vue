<script setup lang="ts">
import Sortable, { type SortableEvent } from 'sortablejs'
import { type DashboardType, type DocumentType, ModelTypes, type TableType } from 'nocodb-sdk'
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isMobileMode } = useGlobal()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const dashboardStore = useDashboardStore()

const { baseTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

const documentsStore = useDocumentsStore()
const { activeDocuments, expandedDocIds } = storeToRefs(documentsStore)

const { isSharedBase } = storeToRefs(useBase())

const { includeM2M } = useGlobal()

const base = inject(ProjectInj)!

const tables = computed(() => (baseTables.value.get(base.value.id!) ?? []).filter((t) => includeM2M.value || !t.mm))

// Load root documents when baseId changes or on mount
watch(
  baseId,
  (id) => {
    if (id) {
      documentsStore.loadDocuments({ baseId: id })
    }
  },
  { immediate: true },
)

const menuRef = useTemplateRef('menuRef')

const isMarked = ref<string | false>(false)

const keys = ref<Record<string, number>>({})

const dragging = ref(false)
const draggingType = ref<'table' | 'dashboard' | 'document' | null>(null)

let sortable: Sortable
let draggedDocId: string | null = null
let draggedSubtreeIds: Set<string> | null = null

// Matches DocumentsNode's indent-step and BASE padding below.
const INDENT_PX = 22
const BASE_INDENT_PX = 8

// Notion-style drop indicator shown only during doc drags.
const dropIndicator = reactive({
  visible: false,
  top: 0,
  depth: 0,
})

const pendingDrop = ref<{ targetParentId: string | null; order: number } | null>(null)

const hasTableCreatePermission = computed(() => {
  return isUIAllowed('tableCreate', { roles: base.value.project_role, source: base.value?.sources?.[0] })
})

// Root-level documents (parent_id is null/undefined)
const rootDocuments = computed(() => activeDocuments.value.filter((d) => !d.parent_id))

interface FlatDocChild {
  doc: DocumentType
  depth: number
  hasChildren: boolean
}

/**
 * Pre-computed map of root doc ID → visible descendants (flattened, respecting expand state).
 * Builds a parent→children index once (O(n)) then walks only expanded branches.
 */
const visibleChildrenMap = computed<Map<string, FlatDocChild[]>>(() => {
  const map = new Map<string, FlatDocChild[]>()
  const allDocs = activeDocuments.value
  const expanded = expandedDocIds.value

  // Build parent→children index (O(n))
  const childrenByParent = new Map<string | null, DocumentType[]>()
  for (const doc of allDocs) {
    const key = doc.parent_id ?? null
    const group = childrenByParent.get(key) || []
    group.push(doc)
    childrenByParent.set(key, group)
  }

  for (const rootDoc of rootDocuments.value) {
    if (!expanded.has(rootDoc.id!)) continue

    const result: FlatDocChild[] = []

    const walk = (parentId: string, depth: number) => {
      const children = (childrenByParent.get(parentId) || []).sort((a, b) => (a.order || 0) - (b.order || 0))

      for (const child of children) {
        const hasChildren = !!child.has_children || childrenByParent.has(child.id!)
        result.push({ doc: child, depth, hasChildren })
        if (expanded.has(child.id!) && hasChildren) {
          walk(child.id!, depth + 1)
        }
      }
    }

    walk(rootDoc.id!, 1)
    if (result.length) {
      map.set(rootDoc.id!, result)
    }
  }

  return map
})

const allEntities = computed<
  Array<(DashboardType & { type: 'dashboard' }) | (TableType & { type: 'table' }) | (DocumentType & { type: 'document' })>
>(() => {
  const entities = []

  // Hide dashboard item in mobile mode as we don't support currently
  if (!isSharedBase.value && !isMobileMode.value) {
    // Add dashboards with type identifier
    for (const dashboard of activeBaseDashboards.value) {
      entities.push({ ...dashboard, type: 'dashboard' as const })
    }
  }

  // Add tables from default source with type identifier
  if (base.value?.sources?.length && base.value?.sources?.[0]?.enabled) {
    const sourceId = base.value?.sources?.[0]?.id
    for (const table of tables.value) {
      if (table.source_id !== sourceId) continue
      entities.push({ ...table, type: 'table' as const })
    }
  }

  // Add root-level documents
  if (!isSharedBase.value && !isMobileMode.value) {
    for (const doc of rootDocuments.value) {
      entities.push({ ...doc, type: 'document' as const })
    }
  }

  return entities.sort((a, b) => (a.order || 0) - (b.order || 0))
})

// Create entities by ID lookup for efficient access
const entitiesById = computed(() =>
  allEntities.value.reduce<Record<string, any>>((acc, entity) => {
    acc[entity.id!] = entity
    return acc
  }, {}),
)

// ── Entry metadata (type + depth for every visible sidebar row) ──
// Tables/dashboards are always depth 0. Root docs are depth 0; child docs
// carry their computed depth from visibleChildrenMap.

interface EntryMeta {
  type: 'table' | 'dashboard' | 'document'
  depth: number
  doc?: DocumentType
}

const entryMetadata = computed<Map<string, EntryMeta>>(() => {
  const map = new Map<string, EntryMeta>()
  for (const entity of allEntities.value) {
    if (entity.type === 'document') {
      map.set(entity.id!, { type: 'document', depth: 0, doc: entity })
      for (const c of visibleChildrenMap.value.get(entity.id!) || []) {
        map.set(c.doc.id!, { type: 'document', depth: c.depth, doc: c.doc })
      }
    } else {
      map.set(entity.id!, { type: entity.type, depth: 0 })
    }
  }
  return map
})

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

// ── Drop-target math (doc drags only) ──
// Mirrors the old Documents/List.vue Notion-style logic: cursor X determines
// depth, then we derive the new parent_id by walking back through the flat
// visible list. Tables/dashboards are treated as depth-0 siblings that
// cannot contain doc children.

interface VisibleEntry {
  id: string
  meta: EntryMeta
  rect: DOMRect
}

function getVisibleEntries(el: HTMLElement): VisibleEntry[] {
  const meta = entryMetadata.value
  const items = Array.from(el.children) as HTMLElement[]
  const entries: VisibleEntry[] = []

  for (const item of items) {
    const id = item.dataset.id
    if (!id) continue
    if (id === draggedDocId) continue
    if (draggedSubtreeIds?.has(id)) continue
    const m = meta.get(id)
    if (!m) continue
    entries.push({ id, meta: m, rect: item.getBoundingClientRect() })
  }

  return entries
}

function findSlot(entries: VisibleEntry[], clientY: number, listTop: number) {
  let slotIndex = entries.length
  let indicatorY = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    const { rect } = entry
    if (clientY < rect.top + rect.height / 2) {
      slotIndex = i
      indicatorY = rect.top - listTop
      break
    }
    indicatorY = rect.bottom - listTop
  }

  return { slotIndex, indicatorY }
}

function calculateDocDropTarget(entries: VisibleEntry[], slotIndex: number, cursorDepth: number) {
  const prev = slotIndex > 0 ? entries[slotIndex - 1] : undefined
  const next = slotIndex < entries.length ? entries[slotIndex] : undefined

  // Depth range — only docs can host doc children, so non-docs cap max at 0.
  const maxDepth = prev ? (prev.meta.type === 'document' ? prev.meta.depth + 1 : 0) : 0
  const minDepth = next ? (next.meta.type === 'document' ? next.meta.depth : 0) : 0
  const targetDepth = Math.max(minDepth, Math.min(maxDepth, cursorDepth))

  // Find parent — walk back to the nearest doc ancestor at targetDepth - 1.
  let targetParentId: string | null = null
  if (targetDepth > 0) {
    for (let i = slotIndex - 1; i >= 0; i--) {
      const e = entries[i]
      if (!e) continue
      if (e.meta.type === 'document' && e.meta.depth === targetDepth - 1) {
        targetParentId = e.id
        break
      }
    }
  }

  // Order — bisect between nearest doc siblings at same depth + parent.
  let prevSiblingOrder: number | null = null
  let nextSiblingOrder: number | null = null

  for (let i = slotIndex - 1; i >= 0; i--) {
    const e = entries[i]
    if (!e) continue
    if (e.meta.type !== 'document') continue
    if (e.meta.depth < targetDepth) break
    if (e.meta.depth === targetDepth && (e.meta.doc!.parent_id ?? null) === targetParentId) {
      prevSiblingOrder = e.meta.doc!.order ?? 0
      break
    }
  }

  for (let i = slotIndex; i < entries.length; i++) {
    const e = entries[i]
    if (!e) continue
    if (e.meta.type !== 'document') continue
    if (e.meta.depth < targetDepth) break
    if (e.meta.depth === targetDepth && (e.meta.doc!.parent_id ?? null) === targetParentId) {
      nextSiblingOrder = e.meta.doc!.order ?? 0
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

function onDragOver(e: DragEvent) {
  if (!dragging.value || draggingType.value !== 'document' || !draggedDocId || e.clientX <= 0) return

  const el = menuRef.value
  if (!el) return

  const listRect = el.getBoundingClientRect()
  const entries = getVisibleEntries(el)
  const { slotIndex, indicatorY } = findSlot(entries, e.clientY, listRect.top)

  const relativeX = e.clientX - listRect.left
  const cursorDepth = Math.max(0, Math.round((relativeX - BASE_INDENT_PX) / INDENT_PX))

  const { targetDepth, targetParentId, order } = calculateDocDropTarget(entries, slotIndex, cursorDepth)

  dropIndicator.visible = true
  dropIndicator.top = indicatorY
  dropIndicator.depth = targetDepth

  pendingDrop.value = { targetParentId, order }
}

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  if (isMobileMode.value) return
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el as HTMLElement, {
    ghostClass: 'ghost',
    // For doc drags we suppress DOM shifting and use the blue indicator line instead;
    // for tables/dashboards we let SortableJS shift items like before.
    onMove: () => {
      return draggingType.value !== 'document'
    },
    onStart: (evt: SortableEvent) => {
      evt.stopImmediatePropagation()
      evt.preventDefault()
      dragging.value = true

      const itemEl = evt.item as HTMLElement
      const type = (itemEl.dataset.type as 'table' | 'dashboard' | 'document') || null
      draggingType.value = type
      pendingDrop.value = null

      if (type === 'document') {
        draggedDocId = itemEl.dataset.id || null
        // Collect all descendant IDs to prevent self-nesting during drag.
        if (draggedDocId) {
          draggedSubtreeIds = new Set<string>()
          const collectDescendants = (parentId: string) => {
            for (const d of activeDocuments.value) {
              if (d.parent_id === parentId && d.id) {
                draggedSubtreeIds!.add(d.id)
                collectDescendants(d.id)
              }
            }
          }
          collectDescendants(draggedDocId)
        }
      }
    },
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      evt.stopImmediatePropagation()
      evt.preventDefault()

      dragging.value = false
      dropIndicator.visible = false

      const itemEl = evt.item as HTMLElement
      const type = draggingType.value
      const docId = draggedDocId

      draggedDocId = null
      draggedSubtreeIds = null
      draggingType.value = null

      // ── Doc drag: apply depth-aware drop (parent + order) ──
      if (type === 'document' && docId) {
        const drop = pendingDrop.value
        pendingDrop.value = null
        if (!drop) return

        const currentDoc = activeDocuments.value.find((d) => d.id === docId)
        if (
          currentDoc &&
          (currentDoc.parent_id ?? null) === drop.targetParentId &&
          currentDoc.order === drop.order
        ) {
          return
        }

        await documentsStore.moveDocument(baseId.value, docId, drop.targetParentId, drop.order)
        markItem(docId)
        $e('a:document:reorder')
        return
      }

      // ── Table / dashboard drag: existing order-only logic ──
      if (newIndex === oldIndex) return

      const item = entitiesById.value[itemEl.dataset.id as string]

      if (!item) return

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && entitiesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && entitiesById.value[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === newIndex) {
        // Item moved to last position
        item.order = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        // Item moved to first position
        item.order = (itemAfter?.order ?? 1) / 2
      } else {
        // Item moved to middle position
        item.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      // Update the allEntities array order to reflect the DOM change
      const entities = [...allEntities.value]
      const [movedEntity] = entities.splice(oldIndex, 1)
      movedEntity.order = item.order
      entities.splice(newIndex, 0, movedEntity)

      // force re-render the list
      if (keys.value.data) {
        keys.value.data = keys.value.data + 1
      } else {
        keys.value.data = 1
      }

      // Update backend based on item type
      if (item.type === 'dashboard') {
        const dashboards = activeBaseDashboards.value
        const dashboardIndex = dashboards.findIndex((d) => d.id === item.id)
        if (dashboardIndex !== -1) {
          dashboards[dashboardIndex].order = item.order
        }
        await dashboardStore.updateDashboard(baseId.value, item.id, {
          order: item.order,
        })
      } else if (item.type === 'table') {
        // Update local table order in the tables array
        const tables = baseTables.value.get(baseId.value)
        const tableIndex = tables.findIndex((t) => t.id === item.id)
        if (tableIndex !== -1) {
          tables[tableIndex].order = item.order
        }

        await $api.internal.postOperation(
          item.fk_workspace_id!,
          item.base_id!,
          {
            operation: 'tableReorder',
            tableId: item.id as string,
          },
          {
            order: item.order,
          },
        )
      }

      markItem(item.id)
      $e('a:data:reorder')
    },
    setData(dataTransfer, dragEl) {
      if (!dragEl?.dataset?.id) {
        return
      }
      dataTransfer.setData(
        'text/json',
        JSON.stringify({
          id: dragEl.dataset.id,
          title: dragEl.dataset.title,
          type: dragEl.dataset.type,
          sourceId: dragEl.dataset.sourceId,
        }),
      )
    },
    animation: 150,
    revertOnSpill: true,
    filter: isTouchEvent,
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })

  el.addEventListener('dragover', onDragOver as EventListener)
}

watchEffect(() => {
  if (menuRef.value && isUIAllowed('viewCreateOrEdit')) {
    initSortable(menuRef.value)
  }
})

onBeforeUnmount(() => {
  if (sortable) sortable.destroy()
  if (menuRef.value) {
    menuRef.value.removeEventListener('dragover', onDragOver as EventListener)
  }
})
</script>

<template>
  <div>
    <!-- Loading skeleton for initial load -->
    <DashboardTreeViewProjectListSkeletonEntity v-if="!allEntities.length && !baseTables.get(baseId)" class="!px-2.5 mt-2" />

    <div
      v-else-if="!allEntities.length && !hasTableCreatePermission"
      class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal"
    >
      {{ $t('placeholder.noTables') }}
    </div>

    <div
      v-else
      ref="menuRef"
      :key="`data-${keys.data || 0}`"
      :class="{ dragging }"
      class="nc-data-menu flex flex-col w-full !border-r-0 bg-nc-bg-gray-sidebar relative"
    >
      <!-- Drop indicator line (Notion-style) — visible only during doc drags -->
      <div
        v-show="dropIndicator.visible && dragging && draggingType === 'document'"
        class="nc-doc-drop-indicator absolute pointer-events-none z-10"
        :style="{
          top: `${dropIndicator.top}px`,
          left: `${BASE_INDENT_PX + dropIndicator.depth * INDENT_PX}px`,
          right: '8px',
        }"
      />

      <template v-for="entity of allEntities" :key="entity.id">
        <DashboardTreeViewDataDashboardNode
          v-if="entity.type === ModelTypes.DASHBOARD"
          :data-id="entity.id"
          :data-order="entity.order"
          :data-title="entity.title"
          :data-type="entity.type"
          class="nc-dashboard-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            'bg-nc-bg-gray-medium': isMarked === entity.id,
            'active': activeDashboardId === entity.id,
          }"
          :dashboard="entity"
        />
        <template v-else-if="entity.type === ModelTypes.DOCUMENT">
          <DashboardTreeViewDocumentsNode
            :data-id="entity.id"
            :data-order="entity.order"
            :data-title="entity.title"
            :data-type="entity.type"
            class="nc-document-item nc-tree-item text-sm"
            :class="{
              'bg-nc-bg-gray-medium': isMarked === entity.id,
            }"
            :doc="entity"
            :has-children="!!entity.has_children"
          />
          <!-- Expanded child documents -->
          <DashboardTreeViewDocumentsNode
            v-for="child of visibleChildrenMap.get(entity.id!) || []"
            :key="child.doc.id"
            :data-id="child.doc.id"
            :data-order="child.doc.order"
            :data-title="child.doc.title"
            data-type="document"
            :doc="child.doc"
            :depth="child.depth"
            :indent-step="INDENT_PX"
            :has-children="child.hasChildren"
            class="nc-document-item nc-tree-item text-sm"
            :class="{
              'bg-nc-bg-gray-medium': isMarked === child.doc.id,
            }"
          />
        </template>
        <DashboardTreeViewTableNode
          v-else
          :data-id="entity.id"
          :data-order="entity.order"
          :data-title="entity.title"
          :data-type="entity.type"
          class="nc-tree-item text-sm"
          :data-source-id="entity?.source_id"
          :table="entity"
          :base="base!"
          :source-index="0"
        />
      </template>
    </div>
    <DashboardTreeViewDataSourceList :base-id="baseId" />
  </div>
</template>

<style lang="scss">
.nc-data-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  .ghost {
    @apply !bg-nc-bg-gray-medium;
  }

  &.dragging {
    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  .ant-menu-title-content {
    @apply !w-full;
  }

  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}

// Blue indicator line with dot — standard tree drag-and-drop visual.
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
