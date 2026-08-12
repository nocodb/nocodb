<script setup lang="ts">
import type { BaseType, SourceType, TableType } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import TableNode from './Node.vue'

const props = withDefaults(
  defineProps<{
    base: BaseType
    baseId: string
    sourceIndex?: number
    showCreateTableBtn?: boolean
  }>(),
  {
    sourceIndex: 0,
    showCreateTableBtn: false,
  },
)

const emits = defineEmits(['createTable'])

const base = toRef(props, 'base')
const sourceIndex = toRef(props, 'sourceIndex')

const source = computed(
  () =>
    base.value?.sources?.[sourceIndex.value] as SourceType & {
      meta?: Record<string, any>
    },
)

// Rendered per-source — expose it to descendant menus (e.g. ViewActionMenu's data-readonly
// upload check via useRoles). The sidebar sits outside Smartsheet.vue, which is where
// ActiveSourceInj is otherwise provided.
provide(ActiveSourceInj, source)

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { openedProject, baseHomeSearchQuery } = storeToRefs(useBases())

const tablesStore = useTablesStore()
const { baseTables } = storeToRefs(tablesStore)
const { loadProjectTables } = tablesStore
const tables = computed(() => baseTables.value.get(base.value.id!) ?? [])

const { viewsByTable } = storeToRefs(useViewsStore())

const { $api } = useNuxtApp()

const tablesById = computed(() =>
  tables.value.reduce<Record<string, TableType>>((acc, table) => {
    acc[table.id!] = table

    return acc
  }, {}),
)

const keys = ref<Record<string, number>>({})

const menuRefs = ref<HTMLElement[] | HTMLElement>()

const sortables: Record<string, Sortable> = {}

// Persist a single table's new order to the backend
function persistTableOrder(tableId: string, order: number) {
  return $api.internal.postOperation(
    base.value.fk_workspace_id!,
    base.value.id!,
    {
      operation: 'tableReorder',
      tableId,
    },
    {
      order,
    },
  )
}

// Force the sortable list to re-render (SortableJS mutates the DOM directly, so
// Vue's patch can miss the reorder unless we bump the container key)
function bumpSortableKey(source_id: string) {
  keys.value[source_id] = (keys.value[source_id] ?? 0) + 1
}

// Keep the local store array in the same order the backend sorts by, so what the
// user sees after the drag matches what a refresh will load (order asc, nulls last)
function resortLocalTables() {
  tables.value.sort((a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity))
}

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  const source_id = el.getAttribute('nc-source')
  if (!source_id) return
  if (isMobileMode.value) return

  if (sortables[source_id]) sortables[source_id].destroy()
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLLIElement
      const item = tablesById.value[itemEl.dataset.id as string]

      if (!item?.id) return

      // the html collection of all list items, already in the dropped order
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // resolve the tables sitting immediately before and after the moved item
      const itemBefore = tablesById.value[(children[newIndex - 1] as HTMLLIElement)?.dataset.id as string]
      const itemAfter = tablesById.value[(children[newIndex + 1] as HTMLLIElement)?.dataset.id as string]

      const beforeOrder = itemBefore?.order ?? null
      const afterOrder = itemAfter?.order ?? null

      // compute a candidate order between the two neighbours (null-safe)
      let newOrder: number
      if (children.length - 1 === newIndex) {
        newOrder = (beforeOrder ?? 0) + 1
      } else if (newIndex === 0) {
        newOrder = (afterOrder ?? 1) / 2
      } else {
        newOrder = ((beforeOrder ?? 0) + (afterOrder ?? 0)) / 2
      }

      // The candidate only yields a stable position when it sits strictly between
      // the neighbours' orders. When sibling tables share the same order or have no
      // order at all (legacy / bulk / sync-created bases), the midpoint collides and
      // the drag would silently revert on next load — renormalise the whole source
      // to distinct, evenly-spaced orders instead.
      const strictlyPlaceable =
        (itemBefore == null || (beforeOrder != null && newOrder > beforeOrder)) &&
        (itemAfter == null || (afterOrder != null && newOrder < afterOrder))

      // snapshot to revert local state if persistence fails
      const prevOrders = tables.value.map((t) => ({ table: t, order: t.order }))

      try {
        if (strictlyPlaceable) {
          item.order = newOrder
          resortLocalTables()
          bumpSortableKey(source_id)

          await persistTableOrder(item.id, newOrder)
        } else {
          // renormalise: walk the dropped DOM order and hand out fresh 1..n orders
          const reordered = (Array.from(children) as HTMLLIElement[])
            .map((child) => tablesById.value[child.dataset.id as string])
            .filter((t): t is TableType => !!t?.id)

          const changed: TableType[] = []
          reordered.forEach((table, index) => {
            const order = index + 1
            if (table.order !== order) {
              table.order = order
              changed.push(table)
            }
          })

          resortLocalTables()
          bumpSortableKey(source_id)

          await Promise.all(changed.map((table) => persistTableOrder(table.id as string, table.order as number)))
        }
      } catch (e) {
        // restore local order and reload from server so the UI reflects reality
        for (const { table, order } of prevOrders) table.order = order
        resortLocalTables()
        bumpSortableKey(source_id)
        message.error(await extractSdkResponseErrorMsg(e))
        await loadProjectTables(base.value.id!, true)
      }
    },
    animation: 150,
    setData(dataTransfer, dragEl) {
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
    revertOnSpill: true,
    filter: isTouchEvent,
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
}

watchEffect(() => {
  if (menuRefs.value && isUIAllowed('viewCreateOrEdit')) {
    if (menuRefs.value instanceof HTMLElement) {
      initSortable(menuRefs.value)
    } else {
      menuRefs.value.forEach((el) => initSortable(el))
    }
  }
})

const availableTables = computed(() => {
  return tables.value.filter((table) => table.source_id === base.value?.sources?.[sourceIndex.value].id)
})

const filteredAvailableTables = computed(() => {
  return availableTables.value.filter((table) => {
    if (searchCompare(table.title, baseHomeSearchQuery.value)) return true
    if (!table.base_id || !table.id) return false
    const key = `${table.base_id}:${table.id}`
    return viewsByTable.value.get(key)?.some((view) => searchCompare(view.title, baseHomeSearchQuery.value))
  })
})
</script>

<template>
  <div class="border-none sortable-list">
    <template v-if="base">
      <div
        v-if="!availableTables.length && showCreateTableBtn"
        :class="{
          'text-nc-content-brand hover:text-nc-content-brand-disabled': openedProject?.id === baseId,
          'text-nc-content-gray-muted hover:text-nc-content-brand': openedProject?.id !== baseId,
        }"
        class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full"
        role="button"
        @click="emits('createTable')"
      >
        <div class="nc-project-home-section-item">
          <GeneralIcon icon="plus" />
          <div>
            {{
              $t('general.createEntity', {
                entity: $t('objects.table'),
              })
            }}
          </div>
        </div>
      </div>

      <div
        v-if="!availableTables.length || !filteredAvailableTables.length"
        class="py-0.5 text-nc-content-gray-muted font-normal"
        :class="{
          'nc-project-home-section-item': sourceIndex === 0,
          'ml-9 xs:(ml-9.75)': sourceIndex !== 0,
        }"
      >
        {{
          availableTables.length && !filteredAvailableTables.length
            ? $t('placeholder.noResultsFoundForYourSearch')
            : $t('placeholder.noTables')
        }}
      </div>

      <div
        v-if="base.sources?.[sourceIndex] && base!.sources[sourceIndex].enabled"
        ref="menuRefs"
        :key="`sortable-${source?.id}-${source?.id && source?.id in keys ? keys[source?.id] : '0'}`"
        :nc-source="source?.id"
      >
        <TableNode
          v-for="table of filteredAvailableTables"
          :key="table.id"
          class="nc-tree-item text-sm"
          :data-order="table.order"
          :data-id="table.id"
          :table="table"
          :base="base"
          :source-index="sourceIndex"
          :data-title="table.title"
          :data-source-id="source?.id"
          :data-type="table.type"
        >
        </TableNode>
      </div>
    </template>
  </div>
</template>
