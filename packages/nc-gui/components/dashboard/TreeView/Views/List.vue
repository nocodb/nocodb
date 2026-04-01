<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes, getFirstNonPersonalView, viewTypeAlias } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'

interface Props {
  /** When provided, only these views are displayed (EE per-section usage) */
  sectionViews?: ViewType[]
  /** When true, applies extra indentation for views nested inside a section */
  isInSection?: boolean
  /** Section ID this list belongs to — enables cross-section drag when set */
  sectionId?: string | null
}

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

  (event: 'viewDragStart'): void

  (event: 'viewDragEnd'): void

  (event: 'viewDroppedInSection', sectionId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isInSection: false,
  sectionId: undefined,
})

const emits = defineEmits<Emits>()
const base = inject(ProjectInj)!
const table = inject(SidebarTableInj)!

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { $api } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { baseHomeSearchQuery } = storeToRefs(useBases())

const { $e } = useNuxtApp()

const { t } = useI18n()

const { viewsByTable, activeView, allRecentViews, isShowEveryonePersonalViewsEnabled } = storeToRefs(useViewsStore())

const views = computed(() => {
  if (!table.value.base_id || !table.value.id) return []
  const key = `${table.value.base_id}:${table.value.id}`
  return viewsByTable.value.get(key) ?? []
})

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

/** Compute new order for an item dropped at newIndex in the target container */
function computeNewOrder(evt: SortableEvent, newIndex: number): number | null {
  const children: HTMLCollection = evt.to.children

  if (children.length <= 1) {
    // Only the moved item in the target — use order 1
    return 1
  }

  const itemBeforeEl = children[newIndex - 1] as HTMLElement | undefined
  const itemAfterEl = children[newIndex + 1] as HTMLElement | undefined

  const itemBefore = itemBeforeEl && views.value.find((v) => v.id === itemBeforeEl.dataset.id)
  const itemAfter = itemAfterEl && views.value.find((v) => v.id === itemAfterEl.dataset.id)

  if (children.length - 1 === newIndex) {
    return (itemBefore?.order ?? 0) + 1
  } else if (newIndex === 0) {
    return (itemAfter?.order ?? 1) / 2
  } else {
    return ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
  }
}

const initSortable = (el: Element) => {
  if (isMobileMode.value) return
  if (sortable) sortable.destroy()

  const hasSectionId = !!props.sectionId

  sortable = Sortable.create(el as HTMLElement, {
    // When sectionId is set, enable cross-section drag via shared group.
    // `put` restricts drops to lists belonging to the same table.
    group: hasSectionId
      ? {
          name: 'views',
          put: (_to, from) => {
            const fromTableId = (from.el as HTMLElement).dataset.tableId
            return fromTableId === table.value.id
          },
        }
      : undefined,
    ghostClass: 'ghost',
    onStart: (evt: SortableEvent) => {
      evt.stopImmediatePropagation()
      evt.preventDefault()
      dragging.value = true
      if (hasSectionId) {
        emits('viewDragStart')
      }
    },
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      evt.stopImmediatePropagation()
      evt.preventDefault()

      dragging.value = false
      if (hasSectionId) {
        emits('viewDragEnd')
      }

      const isCrossSection = evt.from !== evt.to

      if (!isCrossSection && newIndex === oldIndex) return

      const itemEl = evt.item as HTMLElement
      const currentItem = views.value.find((v) => v.id === itemEl.dataset.id)

      if (!currentItem || !currentItem.id) return

      const firstCollaborativeView = getFirstNonPersonalView(views.value, {
        includeViewType: ViewTypes.GRID,
      })

      const isFirstCollaborativeView = firstCollaborativeView?.id === currentItem.id

      const newOrder = computeNewOrder(evt, newIndex)
      if (newOrder == null) return

      currentItem.order = newOrder

      if (isCrossSection) {
        // Cross-section move: update section assignment + order
        const toSectionId = (evt.to as HTMLElement).dataset.sectionId
        const targetSectionId = toSectionId === DEFAULT_SECTION_ID ? null : toSectionId || null

        // Update local state immediately
        ;(currentItem as any).fk_view_section_id = targetSectionId

        if (table.value.base_id && table.value.id) {
          const key = `${table.value.base_id}:${table.value.id}`
          const tableViews = viewsByTable.value.get(key)
          if (tableViews) {
            tableViews.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

            await updateView(currentItem.id, {
              order: currentItem.order,
              fk_view_section_id: targetSectionId,
            } as Partial<ViewType>)

            markItem(currentItem.id)
            $e('a:view:move-to-section:drag', { sectionId: targetSectionId })

            // Notify parent to expand the target section so the dropped view is visible
            if (toSectionId) {
              emits('viewDroppedInSection', toSectionId)
            }
          }
        }
      } else {
        // Same-section reorder (existing logic)
        if (table.value.base_id && table.value.id) {
          const key = `${table.value.base_id}:${table.value.id}`
          const tableViews = viewsByTable.value.get(key)
          if (tableViews) {
            tableViews.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

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
          }
        }
      }
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
    await $api.internal.postOperation(
      view.fk_workspace_id!,
      view.base_id!,
      {
        operation: 'viewUpdate',
        viewId: view.id!,
      },
      {
        title: view.title,
        order: view.order,
      },
    )

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

    await $api.internal.postOperation(
      view.fk_workspace_id!,
      view.base_id!,
      {
        operation: 'viewUpdate',
        viewId: view.id!,
      },
      {
        meta: view.meta,
      },
    )

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
        baseId: base.value.id!,
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
  const sourceViews = props.sectionViews ?? views.value

  return sourceViews.filter((view) => {
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
    <div
      v-if="filteredViews.length || !!sectionId"
      ref="menuRef"
      :data-section-id="sectionId"
      :data-table-id="table?.id"
      :class="{ dragging, 'min-h-6': !!sectionId && !filteredViews.length }"
      class="nc-views-menu flex flex-col w-full !border-r-0 !bg-inherit"
    >
      <div
        v-if="!!sectionId && !filteredViews.length && !dragging"
        class="flex items-center py-1 text-nc-content-gray-muted text-body sm:text-bodyDefaultSm"
        :class="{
          'pl-14.5 xs:(pl-16) rtl:(pr-14.5 pl-0) rtl:xs:(pr-16 pl-0)': isDefaultSource,
          'pl-21.5 xs:(pl-23) rtl:(pr-21.5 pl-0) rtl:xs:(pr-23 pl-0)': !isDefaultSource,
        }"
      >
        {{ $t('general.empty') }}
      </div>
      <DashboardTreeViewViewsNode
        v-for="view of filteredViews"
        :key="view.id"
        :data-id="view.id"
        :data-order="view.order"
        :is-dragging="dragging"
        :data-title="view.title"
        :is-in-section="isInSection"
        :class="{
          'bg-nc-bg-gray-medium': isMarked === view.id,
          'active': activeView?.id === view.id,
          [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
        }"
        :on-validate="validate"
        :table="table"
        :view="view"
        class="nc-view-item !rounded-md !pr-0.75 rtl:!pl-0.75 !py-0.5 w-full transition-all ease-in duration-100"
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
