<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'
import type { Menu as AntMenu } from 'ant-design-vue'
import {
  ActiveViewInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  onMounted,
  parseProp,
  ref,
  resolveComponent,
  useApi,
  useCommandPalette,
  useDialog,
  useNuxtApp,
  useRouter,
  useUndoRedo,
  viewTypeAlias,
  watch,
} from '#imports'

interface Props {
  views: ViewType[]
}

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string; copyViewId?: string; groupingFieldColumnId?: string }): void

  (event: 'deleted'): void
}

const { views = [] } = defineProps<Props>()

const emits = defineEmits<Emits>()

const { $e } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const { api } = useApi()

const router = useRouter()

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineModelScope } = useUndoRedo()

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** dragging renamable view items */
const dragging = ref(false)

const menuRef = ref<typeof AntMenu>()

const isMarked = ref<string | false>(false)

/** Watch currently active view, so we can mark it in the menu */
watch(activeView, (nextActiveView) => {
  if (nextActiveView && nextActiveView.id) {
    selected.value = [nextActiveView.id]
  }
})

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

/** validate view title */
function validate(view: ViewType) {
  if (!view.title || view.title.trim().length < 0) {
    return 'View name is required'
  }

  if (views.some((v) => v.title === view.title && v.id !== view.id)) {
    return 'View name should be unique'
  }

  return true
}

let sortable: Sortable

function onSortStart(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging.value = true
}

async function onSortEnd(evt: SortableEvent, undo = false) {
  if (!undo) {
    evt.stopImmediatePropagation()
    evt.preventDefault()
    dragging.value = false
  }

  if (views.length < 2) return

  const { newIndex = 0, oldIndex = 0 } = evt

  if (newIndex === oldIndex) return

  if (!undo) {
    addUndo({
      redo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(oldIndex, 1)
          ord.splice(newIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd(evt, true)
        },
        args: [],
      },
      undo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(newIndex, 1)
          ord.splice(oldIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd({ ...evt, oldIndex: newIndex, newIndex: oldIndex }, true)
        },
        args: [],
      },
      scope: defineModelScope({ view: activeView.value }),
    })
  }

  const children = evt.to.children as unknown as HTMLLIElement[]

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = views.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  const previousItem = (previousEl ? views.find((v) => v.id === previousEl.id) : {}) as ViewType
  const nextItem = (nextEl ? views.find((v) => v.id === nextEl.id) : {}) as ViewType

  let nextOrder: number

  // set new order value based on the new order of the items
  if (views.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  currentItem.order = _nextOrder

  await api.dbView.update(currentItem.id, { order: _nextOrder })

  markItem(currentItem.id)

  $e('a:view:reorder')
}

const initSortable = (el: HTMLElement) => {
  if (sortable) sortable.destroy()

  sortable = new Sortable(el, {
    // handle: '.nc-drag-icon',
    ghostClass: 'ghost',
    onStart: onSortStart,
    onEnd: onSortEnd,
  })
}

onMounted(() => menuRef.value && initSortable(menuRef.value.$el))

/** Navigate to view by changing url param */
function changeView(view: ViewType) {
  if (
    router.currentRoute.value.query &&
    router.currentRoute.value.query.page &&
    router.currentRoute.value.query.page === 'fields'
  ) {
    router.push({ params: { viewTitle: view.id || '' }, query: router.currentRoute.value.query })
  } else {
    router.push({ params: { viewTitle: view.id || '' } })
  }

  if (view.type === ViewTypes.FORM && selected.value[0] === view.id) {
    // reload the page if the same form view is clicked
    // router.go(0)
    // fix me: router.go(0) reloads entire page. need to reload only the form view
    router.replace({ query: { reload: 'true' } }).then(() => {
      router.replace({ query: {} })
    })
  }
}

/** Rename a view */
async function onRename(view: ViewType, originalTitle?: string, undo = false) {
  try {
    await api.dbView.update(view.id!, {
      title: view.title,
      order: view.order,
    })

    await router.replace({
      params: {
        viewTitle: view.id,
      },
    })

    refreshCommandPalette()

    if (!undo) {
      addUndo({
        redo: {
          fn: (v: ViewType, title: string) => {
            const tempTitle = v.title
            v.title = title
            onRename(v, tempTitle, true)
          },
          args: [view, view.title],
        },
        undo: {
          fn: (v: ViewType, title: string) => {
            const tempTitle = v.title
            v.title = title
            onRename(v, tempTitle, true)
          },
          args: [view, originalTitle],
        },
        scope: defineModelScope({ view: activeView.value }),
      })
    }

    // View renamed successfully
    // message.success(t('msg.success.viewRenamed'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal */
function openDeleteDialog(view: ViewType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewDelete'), {
    'modelValue': isOpen,
    'view': view,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': () => {
      closeDialog()

      emits('deleted')

      refreshCommandPalette()
      if (activeView.value === view) {
        // return to the default view
        router.replace({
          params: {
            viewTitle: views[0].id,
          },
        })
      }
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const setIcon = async (icon: string, view: ViewType) => {
  try {
    // modify the icon property in meta
    view.meta = {
      ...parseProp(view.meta),
      icon,
    }

    api.dbView.update(view.id as string, {
      meta: view.meta,
    })

    $e('a:view:icon:sidebar', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const scrollViewNode = () => {
  const activeViewDom = document.querySelector(`.nc-views-menu [data-view-id="${activeView.value?.id}"]`) as HTMLElement
  if (!activeViewDom) return

  if (isElementInvisible(activeViewDom)) {
    // Scroll to the view node
    activeViewDom?.scrollIntoView({ behavior: 'auto', inline: 'start' })
  }
}

watch(
  () => activeView.value?.id,
  () => {
    if (!activeView.value?.id) return

    // TODO: Find a better way to scroll to the view node
    setTimeout(() => {
      scrollViewNode()
    }, 800)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    class="nc-views-menu flex flex-col !ml-3 w-full !border-r-0 !bg-inherit"
    :selected-keys="selected"
  >
    <!-- Lazy load breaks menu item active styles, i.e. styles never change even when active item changes -->
    <SmartsheetSidebarRenameableMenuItem
      v-for="view of views"
      :id="view.id"
      :key="view.id"
      :view="view"
      :on-validate="validate"
      class="nc-view-item !rounded-md !px-1.25 !py-0.5 w-full transition-all ease-in duration-300"
      :class="{
        'bg-gray-200': isMarked === view.id,
        'active': activeView?.id === view.id,
        [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
      }"
      :data-view-id="view.id"
      @change-view="changeView"
      @open-modal="$emit('openModal', $event)"
      @delete="openDeleteDialog"
      @rename="onRename"
      @select-icon="setIcon($event, view)"
    />
    <div class="min-h-1 max-h-1 w-full bg-transparent"></div>
  </a-menu>
</template>

<style lang="scss">
.nc-views-menu {
  @apply min-h-20 flex-grow;

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
    @apply color-transition;
  }

  .sortable-chosen {
    @apply !bg-gray-100 bg-opacity-60;
  }

  .active {
    @apply bg-gray-200 bg-opacity-60 font-medium;
  }
}
</style>
