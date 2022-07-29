<script lang="ts" setup>
import type { FormType, GalleryType, GridType, KanbanType, ViewTypes } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import type { Menu as AntMenu } from 'ant-design-vue'
import { notification } from 'ant-design-vue'
import RenameableMenuItem from './RenameableMenuItem.vue'
import { computed, inject, onBeforeUnmount, onMounted, ref, unref, useApi, useTabs, watch } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import type { TabItem } from '~/composables/useTabs'
import { TabType } from '~/composables/useTabs'
import { ActiveViewInj, ViewListInj } from '~/context'

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string }): void
  (event: 'deleted'): void
  (event: 'sorted'): void
}

const emits = defineEmits<Emits>()

const activeView = inject(ActiveViewInj, ref())

const views = inject(ViewListInj, ref([]))

const { addTab } = useTabs()

const { api } = useApi()

/** sortable instance */
let sortable: Sortable

/** Selected view(s) for menu */
const selected = ref<string[]>([])

const menuRef = ref<typeof AntMenu>()

let deleteModalVisible = $ref(false)

let toDelete = $ref<Record<string, any> | undefined>()

/** Watch currently active view, so we can mark it in the menu */
watch(activeView, (nextActiveView) => {
  const _nextActiveView = nextActiveView as GridType | FormType | KanbanType

  if (_nextActiveView && _nextActiveView.id) {
    selected.value = [_nextActiveView.id]
  }
})

onBeforeUnmount(() => {
  if (sortable) sortable.destroy()
})

function validate(value?: string) {
  if (!value || value.trim().length < 0) {
    return 'View name is required'
  }

  if ((unref(views) || []).every((v1) => ((v1 as GridType | KanbanType | GalleryType).alias || v1.title) !== value)) {
    return 'View name should be unique'
  }

  return true
}

function initializeSortable(el: HTMLElement) {
  /** if instance exists, destroy it first */
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el, {
    handle: '.nc-drag-icon',
    filter: '.nc-headline',
    onEnd: async (evt) => {
      if (views.value.length < 2) return

      const { newIndex = 0, oldIndex = 0 } = evt

      const currentItem: Record<string, any> = views.value[oldIndex]

      // get items meta of before and after the moved item
      const nextItem: Record<string, any> = views.value[newIndex]
      const previousItem: Record<string, any> = views.value[newIndex + 1]

      let nextOrder: number

      // set new order value based on the new order of the items
      if (views.value.length - 1 === newIndex) {
        nextOrder = parseFloat(nextItem.order) + 1
      } else if (newIndex === 0) {
        nextOrder = parseFloat(nextItem.order) / 2
      } else {
        nextOrder = (parseFloat(nextItem.order) + parseFloat(previousItem.order)) / 2
      }

      await api.dbView.update(currentItem.id, { order: !isNaN(Number(nextOrder)) ? nextOrder.toString() : oldIndex.toString() })
    },
    animation: 150,
  })
}

onMounted(() => {
  initializeSortable(menuRef.value?.$el)
})

// todo: fix view type, alias is missing for some reason?
/** Navigate to view and add new tab if necessary */
function changeView(view: { id: string; alias?: string; title?: string; type: ViewTypes }) {
  activeView.value = view

  const tabProps: TabItem = {
    id: view.id,
    title: (view.alias ?? view.title) || '',
    type: TabType.VIEW,
  }

  addTab(tabProps)
}

/** Rename a view */
async function onRename(view: Record<string, any>) {
  const valid = validate(view.title)

  if (valid !== true) {
    notification.error({
      message: valid,
      duration: 2,
    })
  }

  try {
    // todo typing issues, order and id do not exist on all members of ViewTypes (Kanban, Gallery, Form, Grid)
    await api.dbView.update(view.id, {
      title: view.title,
      order: view.order,
    })

    notification.success({
      message: 'View renamed successfully',
      duration: 3,
    })
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
      duration: 3,
    })
  }
}

/** Delete a view */
async function onDelete(view: Record<string, any>) {
  toDelete = view
  deleteModalVisible = true
}

function onDeleted() {
  emits('deleted')
  toDelete = undefined
  deleteModalVisible = false
}

const sortedViews = computed(() => (views.value as any[]).sort((a, b) => a.order - b.order))
</script>

<template>
  <h3 class="nc-headline pt-3 px-3 text-xs font-semibold">{{ $t('objects.views') }}</h3>

  <a-menu ref="menuRef" class="flex-1 max-h-50vh overflow-y-scroll scrollbar-thin-primary" :selected-keys="selected">
    <RenameableMenuItem
      v-for="view of sortedViews"
      :key="view.id"
      :view="view"
      @change-view="changeView"
      @open-modal="$emit('openModal', $event)"
      @delete="onDelete"
      @rename="onRename"
    />
  </a-menu>

  <dlg-view-delete v-model="deleteModalVisible" :view="toDelete" @deleted="onDeleted" />
</template>
