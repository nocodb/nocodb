<script lang="ts" setup>
import type { ViewType, ViewTypes } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import type { Menu as AntMenu } from 'ant-design-vue'
import type { Ref } from 'vue'
import Sortable from 'sortablejs'
import {
  ActiveViewInj,
  ViewListInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  onMounted,
  ref,
  resolveComponent,
  useApi,
  useDialog,
  useI18n,
  useNuxtApp,
  useRoute,
  useRouter,
  viewTypeAlias,
  watch,
} from '#imports'

const emits = defineEmits<Emits>()

const { t } = useI18n()

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string; copyViewId?: string }): void

  (event: 'deleted'): void
}

const { $e } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const views = inject<Ref<ViewType[]>>(ViewListInj, ref([]))

const { api } = useApi()

const router = useRouter()

const route = useRoute()

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** dragging renamable view items */
let dragging = $ref(false)

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
function validate(view: ViewType) {
  if (!view.title || view.title.trim().length < 0) {
    return 'View name is required'
  }

  if (views.value.some((v) => v.title === view.title && v.id !== view.id)) {
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

  const currentItem = views.value.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  const previousItem = (previousEl ? views.value.find((v) => v.id === previousEl.id) : {}) as ViewType
  const nextItem = (nextEl ? views.value.find((v) => v.id === nextEl.id) : {}) as ViewType

  let nextOrder: number

  // set new order value based on the new order of the items
  if (views.value.length - 1 === newIndex) {
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
  if (view.type === 1 && selected.value[0] === view.id) {
    // reload the page if the same form view is clicked
    // router.go(0)
    // fix me: router.go(0) reloads entire page. need to reload only the form view
    router.replace({ query: { reload: 'true' } }).then(() => {
      router.replace({ query: {} })
    })
  }
}

/** Rename a view */
async function onRename(view: ViewType) {
  try {
    await api.dbView.update(view.id!, {
      title: view.title,
      order: view.order,
    })

    await router.replace({
      params: {
        viewTitle: view.title,
      },
    })

    // View renamed successfully
    message.success(t('msg.success.viewRenamed'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal */
function openDeleteDialog(view: Record<string, any>) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewDelete'), {
    'modelValue': isOpen,
    'view': view,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': () => {
      closeDialog()

      emits('deleted')
      if (activeView.value === view) {
        // return to the default view
        router.replace({
          params: {
            viewTitle: views.value[0].title,
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

watch(views, (nextViews) => {
  if(nextViews?.length && (!activeView.value || !nextViews.includes(activeView.value))){
    activeView.value = nextViews[0]
  }
})
</script>

<template>
  <a-menu ref="menuRef" :class="{ dragging }" class="nc-views-menu flex-1" :selected-keys="selected">
    <LazySmartsheetSidebarRenameableMenuItem
      v-for="(view, index) of views"
      :id="view.id"
      :key="view.id"
      :view="view"
      :on-validate="validate"
      class="transition-all ease-in duration-300"
      :class="{
        'bg-gray-100': isMarked === view.id,
        'active':
          (route.params.viewTitle && route.params.viewTitle === view.title) || (route.params.viewTitle === '' && index === 0),
        [`nc-view-item nc-${viewTypeAlias[view.type] || view.type}-view-item`]: true,
      }"
      @change-view="changeView"
      @open-modal="$emit('openModal', $event)"
      @delete="openDeleteDialog(view)"
      @rename="onRename"
    />
  </a-menu>
</template>

<style lang="scss">
.nc-views-menu {
  @apply flex-1 min-h-[100px] overflow-y-scroll scrollbar-thin-dull;

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
    @apply !bg-primary bg-opacity-25 text-primary;
  }

  .active {
    @apply bg-primary bg-opacity-25 text-primary font-medium;
  }
}
</style>
