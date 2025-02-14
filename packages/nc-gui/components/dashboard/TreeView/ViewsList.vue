<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes, viewTypeAlias } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'
import type { Menu as AntMenu } from 'ant-design-vue'

interface Emits {
  (
    event: 'openModal',
    data: {
      type: ViewTypes
      title?: string
      copyViewId?: string
      groupingFieldColumnId?: string
      coverImageColumnId?: string
    },
  ): void

  (event: 'deleted'): void
}

const emits = defineEmits<Emits>()
const base = inject(ProjectInj)!
const table = inject(SidebarTableInj)!

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { activeTableId } = storeToRefs(useTablesStore())

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { isSharedBase } = storeToRefs(useBase())

const { $e } = useNuxtApp()

const { t } = useI18n()

const { viewsByTable, activeView, allRecentViews } = storeToRefs(useViewsStore())

const { navigateToTable } = useTablesStore()

const views = computed(() => viewsByTable.value.get(table.value.id!)?.filter((v) => !v.is_default) ?? [])

const { api } = useApi()

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineModelScope } = useUndoRedo()

const { navigateToView, loadViews, removeFromRecentViews } = useViewsStore()

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

const source = computed(() => base.value?.sources?.find((b) => b.id === table.value.source_id))

const isDefaultSource = computed(() => {
  if (base.value?.sources?.length === 1) return true

  if (!source.value) return false

  return isDefaultBase(source.value)
})

/** validate view title */
function validate(view: ViewType) {
  if (!view.title || view.title.trim().length < 0) {
    return t('msg.error.viewNameRequired')
  }

  if (views.value.some((v) => v.title === view.title && v.id !== view.id)) {
    return t('msg.error.viewNameDuplicate')
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

  if (views.value.length < 2) return

  let { newIndex = 0, oldIndex = 0 } = evt

  newIndex = newIndex - 1
  oldIndex = oldIndex - 1

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

  const children = Array.from(evt.to.children as unknown as HTMLLIElement[])

  // remove `Create View` children from list
  children.shift()

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = views.value.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  // set default order value as 0 if item not found
  const previousItem = (previousEl ? views.value.find((v) => v.id === previousEl.id) ?? { order: 0 } : { order: 0 }) as ViewType
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

const initSortable = (el: HTMLElement) => {
  if (sortable) sortable.destroy()
  if (isMobileMode.value) return

  sortable = new Sortable(el, {
    // handle: '.nc-drag-icon',
    ghostClass: 'ghost',
    onStart: onSortStart,
    onEnd: onSortEnd,
    filter: isTouchEvent,
  })
}

onMounted(() => menuRef.value && isUIAllowed('viewCreateOrEdit') && initSortable(menuRef.value.$el))

/** Navigate to view by changing url param */
async function changeView(view: ViewType) {
  await navigateToView({
    view,
    tableId: table.value.id!,
    baseId: base.value.id!,
    hardReload: view.type === ViewTypes.FORM && selected.value[0] === view.id,
    doNotSwitchTab: true,
  })

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}

/** Rename a view */
async function onRename(view: ViewType, originalTitle?: string, undo = false) {
  try {
    await api.dbView.update(view.id!, {
      title: view.title,
      order: view.order,
    })

    navigateToView({
      view,
      tableId: table.value.id!,
      baseId: base.value.id!,
      hardReload: view.type === ViewTypes.FORM && selected.value[0] === view.id,
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
    // update view name in recent views
    allRecentViews.value = allRecentViews.value.map((rv) => {
      if (rv.viewId === view.id && rv.tableID === view.fk_model_id) {
        rv.viewName = view.title
      }
      return rv
    })

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
    'onDeleted': async () => {
      closeDialog()

      emits('deleted')

      removeFromRecentViews({
        viewId: view.id,
        tableId: view.fk_model_id,
        baseId: base.value.id,
      })
      refreshCommandPalette()
      if (activeView.value?.id === view.id) {
        navigateToTable({
          tableId: table.value.id!,
          baseId: base.value.id!,
        })
      }

      await loadViews({
        tableId: table.value.id!,
        force: true,
      })

      const activeNonDefaultViews = viewsByTable.value.get(table.value.id!)?.filter((v) => !v.is_default) ?? []

      table.value.meta = {
        ...(table.value.meta as object),
        hasNonDefaultViews: activeNonDefaultViews.length > 1,
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

function onOpenModal({
  title = '',
  type,
  copyViewId,
  groupingFieldColumnId,
  calendarRange,
  coverImageColumnId,
}: {
  title?: string
  type: ViewTypes
  copyViewId?: string
  groupingFieldColumnId?: string
  calendarRange?: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // for ee only
  }>
  coverImageColumnId?: string
}) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isOpen,
    title,
    type,
    'tableId': table.value.id,
    'selectedViewId': copyViewId,
    groupingFieldColumnId,
    'views': views,
    calendarRange,
    coverImageColumnId,
    'baseId': base.value.id,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view?: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        force: true,
        tableId: table.value.id!,
      })

      if (view) {
        navigateToView({
          view,
          tableId: table.value.id!,
          baseId: base.value.id!,
          hardReload: view.type === ViewTypes.FORM && selected.value[0] === view.id,
        })
      }

      $e('a:view:create', { view: view?.type || type })
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-views-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <template v-if="!isSharedBase">
      <DashboardTreeViewCreateViewBtn
        v-if="isUIAllowed('viewCreateOrEdit')"
        :align-left-level="isDefaultSource ? 1 : 2"
        :class="{
          '!pl-13.3 !xs:(pl-13.5)': isDefaultSource,
          '!pl-18.6 !xs:(pl-20)': !isDefaultSource,
        }"
        :source="source"
      >
        <div
          :class="{
            'text-brand-500 hover:text-brand-600': activeTableId === table.id,
            'text-gray-500 hover:text-brand-500': activeTableId !== table.id,
          }"
          class="nc-create-view-btn flex flex-row items-center cursor-pointer rounded-md w-full"
          role="button"
        >
          <div class="flex flex-row items-center pl-1.25 !py-1.5 text-inherit">
            <GeneralIcon icon="plus" />
            <div class="pl-1.75">
              {{
                $t('general.createEntity', {
                  entity: $t('objects.view'),
                })
              }}
            </div>
          </div>
        </div>
      </DashboardTreeViewCreateViewBtn>
    </template>
    <template v-if="views.length">
      <DashboardTreeViewViewsNode
        v-for="view of views"
        :id="view.id"
        :key="view.id"
        :class="{
          'bg-gray-200': isMarked === view.id,
          'active': activeView?.id === view.id,
          [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
        }"
        :data-view-id="view.id"
        :on-validate="validate"
        :table="table"
        :view="view"
        class="nc-view-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        @delete="openDeleteDialog"
        @rename="onRename"
        @change-view="changeView"
        @open-modal="onOpenModal"
        @select-icon="setIcon($event, view)"
      />
    </template>
  </a-menu>
</template>

<style lang="scss">
.nc-views-menu {
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

  .ant-menu-title-content {
    @apply !w-full;
  }

  .sortable-chosen {
    @apply !bg-gray-200;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
