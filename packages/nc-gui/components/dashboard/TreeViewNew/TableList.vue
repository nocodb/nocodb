<script setup lang="ts">
import { defineProps, toRef } from '@vue/runtime-core'
import type { ProjectType, TableType } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import Sortable from 'sortablejs'
import TableNode from './TableNode.vue'
import { useTabs } from '~/store/tab'
import type { TabType } from '~/lib'
import { useProjects } from '~/store/projects'
import { useNuxtApp } from '#app'

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

const { addTab } = useTabs()

const projectsStore = useProjects()

const { projectTableList } = storeToRefs(projectsStore)

const { $api } = useNuxtApp()

const addTableTab = (table: TableType) => {
  addTab({ title: table.title, id: table.id, type: table.type as TabType, projectId: table.project_id })
}

const tablesById = $computed(() =>
  projectTableList.value[project.value.id!]?.reduce<Record<string, TableType>>((acc, table) => {
    acc[table.id!] = table

    return acc
  }, {}),
)
let key = $ref(0)
let sortable: Sortable

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  console.log(el)

  // const base_id = el.getAttribute('nc-base')
  // if (!base_id) return
  if (sortable) sortable.destroy()
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      const offset = projectTableList.value[project.value.id!].findIndex((table) => table.base_id === project.value.bases![baseIndex.value].id)

      const { newIndex = 0, oldIndex = 0 } = evt

      const itemEl = evt.item as HTMLLIElement
      const item = tablesById[itemEl.dataset.id as string]

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLLIElement
      const itemAfterEl = children[newIndex + 1] as HTMLLIElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && tablesById[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && tablesById[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === evt.newIndex) {
        item.order = (itemBefore.order as number) + 1
      } else if (newIndex === 0) {
        item.order = (itemAfter.order as number) / 2
      } else {
        item.order = ((itemBefore.order as number) + (itemAfter.order as number)) / 2
      }

      // todo: move to action
      // update the order of the moved item
      projectTableList.value[project.value.id!]?.splice(
        newIndex + offset,
        0,
        ...projectTableList.value[project.value.id!]?.splice(oldIndex + offset, 1),
      )

      // force re-render the list
      key++

      // update the item order
      await $api.dbTable.reorder(item.id as string, {
        order: item.order,
      })
    },
    animation: 150,
  })
}

const menuRef = (divEl:HTMLDivElement) => {
  if (divEl) {
    initSortable(divEl)
  }
}


</script>

<template>
  <div class="border-none sortable-list">
    <div
      v-if="project.bases[baseIndex] && project.bases[baseIndex].enabled"
      :ref="menuRef"
      :key="key"
      :nc-base="project.bases[baseIndex].id"
    >
      <TableNode
        v-for="table of (projectTableList[project.id] ?? []).filter((table) => table.base_id === project.bases[baseIndex].id)"
        :key="table.id"
        v-e="['a:table:open']"
        class="nc-tree-item text-sm cursor-pointer group"
        :data-order="table.order"
        :data-id="table.id"
        :data-testid="`tree-view-table-${table.title}`"
        :table="table"
        :project="project"
        :base-index="baseIndex"
        @click="addTableTab(table)"
      >
      </TableNode>
    </div>
  </div>
</template>
