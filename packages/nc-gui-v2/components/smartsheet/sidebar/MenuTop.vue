<script lang="ts" setup>
import type { ViewType, ViewTypes } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import type { Menu as AntMenu } from 'ant-design-vue'
import { notification } from 'ant-design-vue'
import type { Ref } from 'vue'
import Sortable from 'sortablejs'
import RenameableMenuItem from './RenameableMenuItem.vue'
import { inject, onMounted, ref, useApi, useRoute, useRouter, watch } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import { ActiveViewInj, ViewListInj } from '~/context'

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string; copyViewId?: string }): void
  (event: 'deleted'): void
  (event: 'sorted'): void
}

const emits = defineEmits<Emits>()

const activeView = inject(ActiveViewInj, ref())

const views = inject<Ref<any[]>>(ViewListInj, ref([]))

const { api } = useApi()

const router = useRouter()

const route = useRoute()

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** dragging renamable view items */
let dragging = $ref(false)

let deleteModalVisible = $ref(false)

/** view to delete for modal */
let toDelete = $ref<Record<string, any> | undefined>()

const menuRef = $ref<typeof AntMenu>()

let isMarked = $ref<string | false>(false)

/** Watch currently active view, so we can mark it in the menu */
watch(activeView, (nextActiveView) => {
  const _nextActiveView = nextActiveView as ViewType

  if (_nextActiveView && _nextActiveView.id) {
    selected.value = [_nextActiveView.id]
  }
})

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked = id
  setTimeout(() => {
    isMarked = false
  }, 300)
}

/** validate view title */
function validate(value?: string) {
  if (!value || value.trim().length < 0) {
    return 'View name is required'
  }

  if (views.value.every((v1) => v1.title !== value)) {
    return 'View name should be unique'
  }

  return true
}

function onSortStart(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging = true
}

async function onSortEnd(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging = false

  if (views.value.length < 2) return

  const { newIndex = 0, oldIndex = 0 } = evt

  if (newIndex === oldIndex) return

  const children = evt.to.children as unknown as HTMLLIElement[]

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem: Record<string, any> = views.value.find((v) => v.id === evt.item.id)
  const previousItem: Record<string, any> = previousEl ? views.value.find((v) => v.id === previousEl.id) : {}
  const nextItem: Record<string, any> = nextEl ? views.value.find((v) => v.id === nextEl.id) : {}

  let nextOrder: number

  // set new order value based on the new order of the items
  if (views.value.length - 1 === newIndex) {
    nextOrder = parseFloat(previousItem.order) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(nextItem.order) / 2
  } else {
    nextOrder = (parseFloat(previousItem.order) + parseFloat(nextItem.order)) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder.toString() : oldIndex.toString()

  currentItem.order = _nextOrder

  await api.dbView.update(currentItem.id, { order: _nextOrder })

  markItem(currentItem.id)
}

let sortable: Sortable

const initSortable = (el: HTMLElement) => {
  if (sortable) sortable.destroy()

  sortable = new Sortable(el, {
    handle: '.nc-drag-icon',
    ghostClass: 'ghost',
    onStart: onSortStart,
    onEnd: onSortEnd,
  })
}

onMounted(() => menuRef && initSortable(menuRef.$el))

/** Navigate to view by changing url param */
function changeView(view: { id: string; alias?: string; title?: string; type: ViewTypes }) {
  router.push({ params: { viewTitle: view.title || '' } })
}

/** Rename a view */
async function onRename(view: ViewType) {
  const valid = validate(view.title)

  if (valid !== true) {
    notification.error({
      message: valid,
      duration: 2,
    })

    return
  }

  try {
    await api.dbView.update(view.id!, {
      title: view.title,
      order: String(view.order),
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

/** Open delete modal */
async function onDelete(view: Record<string, any>) {
  toDelete = view
  deleteModalVisible = true
}

/** View was deleted, trigger reload */
function onDeleted() {
  emits('deleted')
  toDelete = undefined
  deleteModalVisible = false
  // return to the default view
  activeView.value = views.value[0]
}
</script>

<template>
  <h3 class="pt-3 px-3 text-xs font-semibold">{{ $t('objects.views') }}</h3>

  <a-menu ref="menuRef" :class="{ dragging }" class="nc-views-menu" :selected-keys="selected">
    <RenameableMenuItem
      v-for="view of views"
      :id="view.id"
      :key="view.id"
      :view="view"
      class="transition-all ease-in duration-300"
      :class="[
        isMarked === view.id ? 'bg-gray-200' : '',
        route.params.viewTitle && route.params.viewTitle.includes(view.title) ? 'active' : '',
      ]"
      @change-view="changeView"
      @open-modal="$emit('openModal', $event)"
      @delete="onDelete"
      @rename="onRename"
    />
  </a-menu>

  <dlg-view-delete v-model="deleteModalVisible" :view="toDelete" @deleted="onDeleted" />
</template>

<style lang="scss">
.nc-views-menu {
  @apply flex-1 max-h-[30vh] overflow-y-scroll scrollbar-thin-dull;

  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition hover:!bg-transparent;
  }

  .sortable-chosen {
    @apply !bg-primary/25 text-primary;
  }

  .active {
    @apply bg-blue-500/15;

    .nc-icon {
      @apply !text-pink-500;
    }
  }
}
</style>
