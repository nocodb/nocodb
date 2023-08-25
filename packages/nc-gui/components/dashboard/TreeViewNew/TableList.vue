<script setup lang="ts">
import type { ProjectType, TableType } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import Sortable from 'sortablejs'
import TableNode from './TableNode.vue'
import { useNuxtApp } from '#app'
import { toRef } from '#imports'

const props = withDefaults(
  defineProps<{
    project: ProjectType
    baseIndex?: number
  }>(),
  {
    baseIndex: 0,
  },
)

const project = toRef(props, 'project')
const baseIndex = toRef(props, 'baseIndex')

const base = computed(() => project.value?.bases?.[baseIndex.value])

const { projectTables } = storeToRefs(useTablesStore())
const tables = computed(() => projectTables.value.get(project.value.id!) ?? [])

const { $api } = useNuxtApp()

const { openTable } = useTableNew({
  projectId: project.value.id!,
})

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
  const base_id = el.getAttribute('nc-base')
  if (!base_id) return

  if (sortables[base_id]) sortables[base_id].destroy()
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      const offset = tables.value.findIndex((table) => table.base_id === base_id)

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
      if (keys.value[base_id]) {
        keys.value[base_id] = keys.value[base_id] + 1
      } else {
        keys.value[base_id] = 1
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
          baseId: dragEl.dataset.baseId,
        }),
      )
    },
    revertOnSpill: true,
  })
}

watchEffect(() => {
  if (menuRefs.value) {
    if (menuRefs.value instanceof HTMLElement) {
      initSortable(menuRefs.value)
    } else {
      menuRefs.value.forEach((el) => initSortable(el))
    }
  }
})

const availableTables = computed(() => {
  return tables.value.filter((table) => table.base_id === project.value?.bases?.[baseIndex.value].id)
})
</script>

<template>
  <div class="border-none sortable-list">
    <template v-if="project">
      <div
        v-if="availableTables.length === 0"
        class="py-0.5 text-gray-500"
        :class="{
          'ml-13.55': baseIndex === 0,
          'ml-19.25': baseIndex !== 0,
        }"
      >
        Empty
      </div>
      <div
        v-if="project.bases?.[baseIndex] && project!.bases[baseIndex].enabled"
        ref="menuRefs"
        :key="`sortable-${base?.id}-${base?.id && base?.id in keys ? keys[base?.id] : '0'}`"
        :nc-base="base?.id"
      >
        <TableNode
          v-for="table of availableTables"
          :key="table.id"
          v-e="['a:table:open']"
          class="nc-tree-item text-sm cursor-pointer group"
          :data-order="table.order"
          :data-id="table.id"
          :data-testid="`tree-view-table-${table.title}`"
          :table="table"
          :project="project"
          :base-index="baseIndex"
          :data-title="table.title"
          :data-base-id="base?.id"
          :data-type="table.type"
          @click="openTable(table)"
        >
        </TableNode>
      </div>
    </template>
  </div>
</template>
