<script lang="ts" setup>
import type { ViewType, ViewSectionType } from 'nocodb-sdk'
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

const { $api } = useNuxtApp()

const { activeTableId } = storeToRefs(useTablesStore())

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { baseHomeSearchQuery } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { $e } = useNuxtApp()

const { t } = useI18n()

const { viewsByTable, activeView, allRecentViews, isShowEveryonePersonalViewsEnabled } = storeToRefs(useViewsStore())

const viewSectionsStore = useViewSectionsStore()

const { sections } = storeToRefs(viewSectionsStore)

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

/** Expanded sections state stored in localStorage */
const expandedSections = ref<Record<string, boolean>>({})

/** Load expanded sections from localStorage */
const loadExpandedSections = () => {
  if (!table.value.base_id || !table.value.id) return
  const key = `view-sections-expanded-${table.value.base_id}:${table.value.id}`
  const stored = localStorage.getItem(key)
  if (stored) {
    expandedSections.value = JSON.parse(stored)
  }
}

/** Save expanded sections to localStorage */
const saveExpandedSections = () => {
  if (!table.value.base_id || !table.value.id) return
  const key = `view-sections-expanded-${table.value.base_id}:${table.value.id}`
  localStorage.setItem(key, JSON.stringify(expandedSections.value))
}

/** Toggle section expanded state */
const toggleSectionExpanded = (sectionId?: string) => {
  if (!sectionId) return
  expandedSections.value[sectionId] = !expandedSections.value[sectionId]
  saveExpandedSections()
}

/** Expand all sections */
const expandAllSections = () => {
  for (const section of sections.value) {
    if (section.id) {
      expandedSections.value[section.id] = true
    }
  }
  saveExpandedSections()
}

/** Collapse all sections */
const collapseAllSections = () => {
  for (const section of sections.value) {
    if (section.id) {
      expandedSections.value[section.id] = false
    }
  }
  saveExpandedSections()
}

/** Whether all sections are currently expanded */
const allSectionsExpanded = computed(() => {
  if (!sections.value.length) return false
  return sections.value.every((s) => s.id && expandedSections.value[s.id])
})

/** Whether all sections are currently collapsed */
const allSectionsCollapsed = computed(() => {
  if (!sections.value.length) return false
  return sections.value.every((s) => !s.id || !expandedSections.value[s.id])
})

/** Get views for a specific section */
const getViewsInSection = (sectionId?: string) => {
  return views.value.filter((v) => v.fk_view_section_id === sectionId)
}

/** Get top-level views (not in any section) */
const getTopLevelViews = () => {
  return views.value.filter((v) => !v.fk_view_section_id)
}

/** Compute top-level items (sections and top-level views) sorted by order */
const topLevelItems = computed(() => {
  const items: Array<{ type: 'section' | 'view'; id: string; order: number; data: ViewSectionType | ViewType }> = []

  // Add sections
  for (const section of sections.value) {
    items.push({
      type: 'section',
      id: section.id || '',
      order: section.order || 0,
      data: section,
    })
  }

  // Add top-level views
  for (const view of getTopLevelViews()) {
    items.push({
      type: 'view',
      id: view.id || '',
      order: view.order || 0,
      data: view,
    })
  }

  // Sort by order
  return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

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
      const itemId = itemEl.dataset.id
      const itemType = itemEl.dataset.type

      if (!itemId) return

      if (itemType === 'view') {
        // Handle view reordering
        const currentItem = views.value.find((v) => v.id === itemId)
        if (!currentItem || !currentItem.id) return

        const firstCollaborativeView = getFirstNonPersonalView(views.value, {
          includeViewType: ViewTypes.GRID,
        })

        const isFirstCollaborativeView = firstCollaborativeView?.id === currentItem.id

        const children: HTMLCollection = evt.to.children

        if (children.length < 2) return

        const itemBeforeEl = children[newIndex - 1] as HTMLElement
        const itemAfterEl = children[newIndex + 1] as HTMLElement

        const itemBefore = itemBeforeEl && views.value.find((v) => v.id === itemBeforeEl.dataset.id)
        const itemAfter = itemAfterEl && views.value.find((v) => v.id === itemAfterEl.dataset.id)

        if (children.length - 1 === newIndex) {
          currentItem.order = (itemBefore?.order ?? 0) + 1
        } else if (newIndex === 0) {
          currentItem.order = (itemAfter?.order ?? 1) / 2
        } else {
          currentItem.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
        }

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
      } else if (itemType === 'section') {
        // Handle section reordering
        const currentItem = sections.value.find((s) => s.id === itemId)
        if (!currentItem || !currentItem.id) return

        const children: HTMLCollection = evt.to.children

        if (children.length < 2) return

        const itemBeforeEl = children[newIndex - 1] as HTMLElement
        const itemAfterEl = children[newIndex + 1] as HTMLElement

        const itemBefore = itemBeforeEl && sections.value.find((s) => s.id === itemBeforeEl.dataset.id)
        const itemAfter = itemAfterEl && sections.value.find((s) => s.id === itemAfterEl.dataset.id)

        if (children.length - 1 === newIndex) {
          currentItem.order = (itemBefore?.order ?? 0) + 1
        } else if (newIndex === 0) {
          currentItem.order = (itemAfter?.order ?? 1) / 2
        } else {
          currentItem.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
        }

        await viewSectionsStore.reorderSection(currentItem.id, currentItem.order)
        markItem(currentItem.id)
        $e('a:view-section:reorder')
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

    allRecentViews.value = allRecentViews.value.map((rv) => {
      if (rv.viewId === view.id && rv.tableID === view.fk_model_id) {
        rv.viewName = view.title
      }
      return rv
    })
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

/** Rename a section */
async function onRenameSection(section: ViewSectionType, newTitle: string) {
  if (!section.id) return

  try {
    const updated = await viewSectionsStore.updateSection(section.id, { title: newTitle })

    if (!updated) {
      // Revert on error
      section.title = section.title
    }

    $e('a:view-section:rename')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Section pending delete (for dialog) */
const sectionToDelete = ref<ViewSectionType | null>(null)
const showDeleteSectionModal = ref(false)

/** Open delete section dialog */
function openDeleteSectionDialog(section: ViewSectionType) {
  sectionToDelete.value = section
  showDeleteSectionModal.value = true
}

/** Confirm section deletion */
async function onDeleteSection() {
  if (!sectionToDelete.value?.id) return

  try {
    await viewSectionsStore.deleteSection(sectionToDelete.value.id)
    $e('a:view-section:delete')

    // Reload views since child views were moved to top-level
    await loadViews({
      force: true,
      tableId: table.value.id!,
      baseId: base.value.id!,
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  showDeleteSectionModal.value = false
  sectionToDelete.value = null
}

const setIcon = async (icon: string, view: ViewType) => {
  try {
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
    fk_to_column_id: string | null
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

/** Create a new section */
async function onCreateSection() {
  if (!table.value.id) return

  try {
    // Calculate order: place after the last item
    const lastOrder = Math.max(
      ...sections.value.map((s) => s.order || 0),
      ...getTopLevelViews().map((v) => v.order || 0),
      0,
    )

    const section = await viewSectionsStore.createSection(table.value.id, {
      title: viewSectionsStore.getNextSectionTitle(),
      order: lastOrder + 1,
    })

    if (section?.id) {
      expandedSections.value[section.id] = true
      saveExpandedSections()
    }

    $e('a:view-section:create')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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

/** Load sections and init expanded state on table change */
watch(
  () => table.value.id,
  async (newTableId) => {
    if (newTableId) {
      await viewSectionsStore.loadSections({
        tableId: newTableId,
        baseId: table.value.base_id!,
      })
      loadExpandedSections()
    }
  },
  { immediate: true },
)
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
        @create-section="onCreateSection"
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
              {{ $t('general.create') }}
            </div>
          </div>
        </div>
      </DashboardTreeViewCreateViewBtn>
    </template>
    <div
      v-if="topLevelItems.length || filteredViews.length"
      ref="menuRef"
      :class="{ dragging }"
      class="nc-views-menu flex flex-col w-full !border-r-0 !bg-inherit"
    >
      <!-- Render top-level items (sections and views) -->
      <template v-for="item of topLevelItems" :key="item.id">
        <!-- Section node with child views -->
        <div v-if="item.type === 'section'" :data-id="item.id" :data-type="'section'" class="nc-section-item w-full">
          <DashboardTreeViewViewsSectionNode
            :section="item.data as ViewSectionType"
            :is-expanded="!!expandedSections[item.id]"
            :all-expanded="allSectionsExpanded"
            :all-collapsed="allSectionsCollapsed"
            @expand-toggle="toggleSectionExpanded(item.id)"
            @rename="onRenameSection(item.data as ViewSectionType, $event)"
            @delete="openDeleteSectionDialog(item.data as ViewSectionType)"
            @open-menu="null"
            @expand-all="expandAllSections"
            @collapse-all="collapseAllSections"
          />

          <!-- Child views of this section -->
          <template v-if="expandedSections[item.id]">
            <DashboardTreeViewViewsNode
              v-for="view of getViewsInSection(item.id)"
              :key="view.id"
              :data-id="view.id"
              :data-order="view.order"
              :data-title="view.title"
              :data-type="'view'"
              :class="{
                'bg-nc-bg-gray-medium': isMarked === view.id,
                'active': activeView?.id === view.id,
                [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
              }"
              :on-validate="validate"
              :table="table"
              :view="view"
              class="nc-view-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100 !pl-12 !xs:(!pl-12)"
              @delete="openDeleteDialog"
              @rename="onRename"
              @change-view="changeView"
              @open-modal="onOpenModal"
              @select-icon="setIcon($event, view)"
            />
          </template>
        </div>

        <!-- Top-level view node (not in any section) -->
        <DashboardTreeViewViewsNode
          v-else
          :key="item.id"
          :data-id="item.id"
          :data-order="item.data.order"
          :data-title="item.data.title"
          :data-type="'view'"
          :class="{
            'bg-nc-bg-gray-medium': isMarked === item.id,
            'active': activeView?.id === item.id,
            [`nc-${item.data.type ? viewTypeAlias[item.data.type] : undefined || item.data.type}-view-item`]: true,
          }"
          :on-validate="validate"
          :table="table"
          :view="item.data as ViewType"
          class="nc-view-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          @delete="openDeleteDialog"
          @rename="onRename"
          @change-view="changeView"
          @open-modal="onOpenModal"
          @select-icon="setIcon($event, item.data as ViewType)"
        />
      </template>
    </div>

    <!-- Delete section confirmation modal -->
    <GeneralDeleteModal
      v-model:visible="showDeleteSectionModal"
      :entity-name="$t('objects.section')"
      :on-delete="onDeleteSection"
    >
      <template #entity-preview>
        <div
          v-if="sectionToDelete"
          class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle"
        >
          <GeneralIcon icon="ncFolder" class="w-4 min-h-4" style="color: #3f8292" />
          <div
            class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          >
            <span>{{ sectionToDelete.title }}</span>
          </div>
        </div>
        <div class="mt-2 text-nc-content-gray-subtle text-sm">
          {{ $t('msg.info.sectionDeleteConfirmation') }}
        </div>
      </template>
    </GeneralDeleteModal>
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

  .nc-section-item {
    @apply w-full;
  }
}
</style>
