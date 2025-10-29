<script setup lang="ts">
import type { BaseType, TableType } from 'nocodb-sdk'
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

const source = computed(() => base.value?.sources?.[sourceIndex.value])

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { openedProject, baseHomeSearchQuery } = storeToRefs(useBases())

const { baseTables } = storeToRefs(useTablesStore())
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

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  const source_id = el.getAttribute('nc-source')
  if (!source_id) return
  if (isMobileMode.value) return

  if (sortables[source_id]) sortables[source_id].destroy()
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      const offset = tables.value.findIndex((table) => table.source_id === source_id)

      const { newIndex = 0, oldIndex = 0 } = evt

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLLIElement
      const item = tablesById.value[itemEl.dataset.id as string]

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLLIElement
      const itemAfterEl = children[newIndex + 1] as HTMLLIElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && tablesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && tablesById.value[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === evt.newIndex) {
        item.order = (itemBefore.order as number) + 1
      } else if (newIndex === 0) {
        item.order = (itemAfter.order as number) / 2
      } else {
        item.order = ((itemBefore.order as number) + (itemAfter.order as number)) / 2
      }

      // update the order of the moved item
      tables.value?.splice(newIndex + offset, 0, ...tables.value?.splice(oldIndex + offset, 1))

      // force re-render the list
      if (keys.value[source_id]) {
        keys.value[source_id] = keys.value[source_id] + 1
      } else {
        keys.value[source_id] = 1
      }

      // update the item order
      await $api.dbTable.reorder(item.id as string, {
        order: item.order,
      })
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
  return availableTables.value.filter(
    (table) =>
      searchCompare(table.title, baseHomeSearchQuery.value) ||
      viewsByTable.value.get(table.id!)?.some((view) => searchCompare(view.title, baseHomeSearchQuery.value)),
  )
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
