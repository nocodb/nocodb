<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes, getFirstNonPersonalView, viewTypeAlias } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'

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

const { baseHomeSearchQuery } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { $e } = useNuxtApp()

const { t } = useI18n()

const { viewsByTable, activeView, allRecentViews, isShowEveryonePersonalViewsEnabled } = storeToRefs(useViewsStore())

const views = computed(() => viewsByTable.value.get(table.value.id!) ?? [])

const { api } = useApi()

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineModelScope } = useUndoRedo()

const { navigateToView, loadViews, isUserViewOwner, updateView } = useViewsStore()

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** dragging renamable view items */
const dragging = ref(false)

const menuRef = useTemplateRef('menuRef')

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

  if (views.value.some((v) => v.title?.trim() === view.title.trim() && v.id !== view.id)) {
    return t('msg.error.viewNameDuplicate')
  }

  return true
}

let sortable: Sortable

const initSortable = (el: Element) => {
  if (isMobileMode.value) return
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el as HTMLElement, {
    ghostClass: 'ghost',
    onStart: (evt: SortableEvent) => {
      evt.stopImmediatePropagation()
      evt.preventDefault()
      dragging.value = true
    },
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      evt.stopImmediatePropagation()
      evt.preventDefault()

      dragging.value = false

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLElement
      const currentItem = views.value.find((v) => v.id === itemEl.dataset.id)

      if (!currentItem || !currentItem.id) return

      const firstCollaborativeView = getFirstNonPersonalView(views.value, {
        includeViewType: ViewTypes.GRID,
      })

      const isFirstCollaborativeView = firstCollaborativeView?.id === currentItem.id

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && views.value.find((v) => v.id === itemBeforeEl.dataset.id)
      const itemAfter = itemAfterEl && views.value.find((v) => v.id === itemAfterEl.dataset.id)

      // set new order value based on the new order of the items
      if (children.length - 1 === newIndex) {
        // Item moved to last position
        currentItem.order = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        // Item moved to first position
        currentItem.order = (itemAfter?.order ?? 1) / 2
      } else {
        // Item moved to middle position
        currentItem.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      // Update the order in the viewsByTable map to trigger reactivity
      const tableViews = viewsByTable.value.get(table.value.id!)
      if (tableViews) {
        // Sort the views array by order to reflect the new position
        tableViews.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }

      const defaultViewAfterUpdate = getFirstNonPersonalView(tableViews, {
        includeViewType: ViewTypes.GRID,
      })

      await updateView(
        currentItem.id,
        {
          order: currentItem.order,
        },
        {
          is_default_view: isFirstCollaborativeView || defaultViewAfterUpdate?.id !== firstCollaborativeView?.id,
        },
      )

      markItem(currentItem.id)
      $e('a:view:reorder')
    },
    animation: 150,
    revertOnSpill: true,
    filter: isTouchEvent,
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
}

watchEffect(() => {
  if (menuRef.value && isUIAllowed('viewCreateOrEdit')) {
    initSortable(menuRef.value)
  }
})

/** Navigate to view by changing url param */
async function changeView(view: ViewType) {
  await navigateToView({
    view,
    tableId: table.value.id!,
    tableTitle: table.value.title,
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
      tableTitle: table.value.title,
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
    'sourceId': source.value?.id,
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
          tableTitle: table.value.title,
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

const filteredViews = computed(() => {
  return views.value.filter((view) => {
    if (isShowEveryonePersonalViewsEnabled.value) {
      return searchCompare(view.title, baseHomeSearchQuery.value)
    }

    const isPersonalViewOwner = activeView.value?.id === view.id || view?.lock_type !== LockType.Personal || isUserViewOwner(view)

    return searchCompare(view.title, baseHomeSearchQuery.value) && isPersonalViewOwner
  })
})
</script>

<template>
  <div>
    <template v-if="!isSharedBase">
      <DashboardTreeViewCreateViewBtn
        v-if="isUIAllowed('viewCreateOrEdit')"
        :align-left-level="isDefaultSource ? 1 : 2"
        :class="{
          '!pl-7.5 !xs:(pl-7.5)': isDefaultSource,
          '!pl-13.6 !xs:(pl-15)': !isDefaultSource,
        }"
        :source="source"
      >
        <div
          :class="{
            'text-nc-content-brand hover:text-nc-content-brand-disabled': activeTableId === table.id,
            'text-nc-content-gray-muted hover:text-nc-content-brand': activeTableId !== table.id,
          }"
          class="nc-create-view-btn flex flex-row items-center cursor-pointer rounded-md w-full"
          role="button"
        >
          <div class="flex flex-row items-center pl-1.25 !py-1.5 text-inherit">
            <GeneralIcon icon="plus" class="nc-create-view-btn-icon" />
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
    <div
      v-if="filteredViews.length"
      ref="menuRef"
      :class="{ dragging }"
      class="nc-views-menu flex flex-col w-full !border-r-0 !bg-inherit"
    >
      <DashboardTreeViewViewsNode
        v-for="view of filteredViews"
        :key="view.id"
        :data-id="view.id"
        :data-order="view.order"
        :data-title="view.title"
        :class="{
          'bg-nc-bg-gray-medium': isMarked === view.id,
          'active': activeView?.id === view.id,
          [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
        }"
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
    </div>
  </div>
</template>

<style lang="scss">
.nc-views-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  .ghost {
    @apply !bg-nc-bg-gray-medium;
  }

  &.dragging {
    .nc-view-icon {
      @apply !block;
    }
  }

  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}
</style>
