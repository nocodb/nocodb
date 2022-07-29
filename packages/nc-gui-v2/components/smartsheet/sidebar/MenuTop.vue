<script lang="ts" setup>
import type { FormType, GalleryType, GridType, KanbanType, ViewTypes } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import { notification } from 'ant-design-vue'
import RenameableMenuItem from './RenameableMenuItem.vue'
import { inject, onBeforeUnmount, ref, unref, useApi, useNuxtApp, useTabs, useViews, watch } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import type { TabItem } from '~/composables/useTabs'
import { TabType } from '~/composables/useTabs'
import { ActiveViewInj, MetaInj } from '~/context'

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string }): void
}

const emits = defineEmits<Emits>()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { $e } = useNuxtApp()

const { addTab } = useTabs()

const { views, loadViews } = useViews(meta)

const { api } = useApi()

/** sortable instance */
let sortable: Sortable

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** Watch current views and on change set the next active view */
watch(
  views,
  (nextViews) => {
    if (nextViews.length) {
      activeView.value = nextViews[0]
    }
  },
  { immediate: true },
)

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
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      const itemEl = evt.item as HTMLLIElement
      console.log(itemEl)
    },
    animation: 150,
  })
}

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
  try {
    await api.dbView.delete(view.id)

    notification.success({
      message: 'View deleted successfully',
      duration: 3,
    })

    await loadViews()

    console.log(views.value)
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
      duration: 3,
    })
  }

  // telemetry event
  $e('a:view:delete', { view: view.type })
}
</script>

<template>
  <a-menu class="flex-1 max-h-50vh overflow-y-scroll scrollbar-thin-primary" :selected-keys="selected">
    <h3 class="pt-3 px-3 text-xs font-semibold">{{ $t('objects.views') }}</h3>

    <RenameableMenuItem
      v-for="view of views"
      :key="view.id"
      :view="view"
      @change-view="changeView"
      @open-modal="$emit('openModal', $event)"
      @delete="onDelete"
      @rename="onRename"
    />
  </a-menu>
</template>
