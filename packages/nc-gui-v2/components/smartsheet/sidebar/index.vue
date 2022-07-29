<script setup lang="ts">
import type { FormType, GalleryType, GridType, KanbanType, ViewTypes } from 'nocodb-sdk'
import MenuTop from './MenuTop.vue'
import MenuBottom from './MenuBottom.vue'
import { inject, provide, ref, useApi, useViews } from '#imports'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/context'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { views } = useViews(meta)

const { api } = useApi()

provide(ViewListInj, views)

/** Sidebar visible */
const drawerOpen = inject('navDrawerOpen', ref(false))

/** View type to create from modal */
let viewCreateType = $ref<ViewTypes>()

/** View title to create from modal (when duplicating) */
let viewCreateTitle = $ref('')

/** is view creation modal open */
let modalOpen = $ref(false)

/** Open view creation modal */
function openModal({ type, title = '' }: { type: ViewTypes; title: string }) {
  modalOpen = true
  viewCreateType = type
  viewCreateTitle = title
}

/** Handle view creation */
function onCreate(view: GridType | FormType | KanbanType | GalleryType) {
  views.value?.push(view)
  activeView.value = view
  modalOpen = false
}
</script>

<template>
  <a-layout-sider theme="light" class="shadow" :width="drawerOpen ? 0 : 250">
    <div class="flex flex-col h-full">
      <MenuTop @open-modal="openModal" />
      <MenuBottom @open-modal="openModal" />
    </div>

    <dlg-view-create v-if="views" v-model="modalOpen" :title="viewCreateTitle" :type="viewCreateType" @created="onCreate" />
  </a-layout-sider>
</template>

<style scoped>
:deep(.ant-menu-title-content) {
  @apply w-full;
}
</style>
