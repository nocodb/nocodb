<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { TableType, ViewType } from 'nocodb-sdk'
import ProjectWrapper from '../ProjectWrapper.vue'

const { isUIAllowed } = useRoles()

const { $e, $api } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const basesStore = useBases()

const { createProject: _createProject, updateProject } = basesStore

const { bases, basesList, activeProjectId, showProjectList, isProjectsLoaded } = storeToRefs(basesStore)

const { isWorkspaceLoading, activeWorkspaceId } = storeToRefs(useWorkspace())

const baseCreateDlg = ref(false)

const searchQuery = ref('')

const searchInputRef = ref()

const isCreateProjectOpen = ref(false)

const filteredProjectList = computed(() => basesList.value.filter((base) => searchCompare(base.title, searchQuery.value)))

const baseStore = useBase()

const { loadTables } = baseStore

const { isSharedBase, base } = storeToRefs(baseStore)

const tablesStore = useTablesStore()

const { loadProjectTables } = tablesStore

const { activeTable: _activeTable } = storeToRefs(tablesStore)

const { isMobileMode } = useGlobal()

const { setMeta } = useMetas()

const { allRecentViews } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineProjectScope } = useUndoRedo()

const openedBase = computed(() => {
  return basesList.value.find((b) => b.id === activeProjectId.value)
})

const stopLoading = ref(false)

const isLoadingSidebar = computed(() => {
  if (!stopLoading.value) return true

  return !isProjectsLoaded.value
})

let stopTimerId: any
watch(
  () => ncIsEmptyObject(route.value.params),
  () => {
    clearTimeout(stopTimerId)

    if (ncIsEmptyObject(route.value.params)) {
      if (isProjectsLoaded.value && !basesList.value.length) {
        stopLoading.value = true
        showProjectList.value = true

        return
      } else {
        stopLoading.value = false
      }
    } else {
      stopLoading.value = true
      return
    }

    stopTimerId = setTimeout(() => {
      stopLoading.value = true
      clearTimeout(stopTimerId)

      // If their is no active project then show base list
      if (!showProjectList.value && (!activeProjectId.value || !openedBase.value?.id)) {
        showProjectList.value = true
      }
    }, 5000)
  },
  {
    immediate: true,
  },
)

const contextMenuTarget = reactive<{ type?: 'base' | 'source' | 'table' | 'main' | 'layout'; value?: any }>({})

const setMenuContext = (type: 'base' | 'source' | 'table' | 'main' | 'layout', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

function openViewDescriptionDialog(view: ViewType) {
  if (!view || !view.id) return

  $e('c:view:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewDescriptionUpdate'), {
    'modelValue': isOpen,
    'view': view,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableDescriptionDialog(table: TableType) {
  if (!table || !table.id) return

  $e('c:table:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableDescriptionUpdate'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

/**
 * tableRenameId is combination of tableId & sourceId
 * @example `${tableId}:${sourceId}`
 */
const tableRenameId = ref('')

async function handleTableRename(
  table: TableType,
  title: string,
  originalTitle: string,
  updateTitle: (title: string) => void,
  undo = false,
  disableTitleDiffCheck?: boolean,
) {
  if (!table || !table.source_id) return

  if (title) {
    title = title.trim()
  }

  if (title === originalTitle && !disableTitleDiffCheck) return

  updateTitle(title)

  try {
    await $api.dbTable.update(table.id as string, {
      base_id: table.base_id,
      table_name: title,
      title,
    })

    await loadProjectTables(table.base_id!, true)

    if (!undo) {
      addUndo({
        redo: {
          fn: (table: TableType, t: string, ot: string, updateTitle: (title: string) => void) => {
            handleTableRename(table, t, ot, updateTitle, true, true)
          },
          args: [table, title, originalTitle, updateTitle],
        },
        undo: {
          fn: (table: TableType, t: string, ot: string, updateTitle: (title: string) => void) => {
            handleTableRename(table, t, ot, updateTitle, true, true)
          },
          args: [table, originalTitle, title, updateTitle],
        },
        scope: defineProjectScope({ model: table }),
      })
    }

    await loadTables()

    // update recent views if default view is renamed
    allRecentViews.value = allRecentViews.value.map((v) => {
      if (v.tableID === table.id) {
        if (v.isDefault) v.viewName = title

        v.tableName = title
      }
      return v
    })

    // update metas
    const newMeta = await $api.dbTable.read(table.id as string)
    await setMeta(newMeta)
    refreshCommandPalette()

    $e('a:table:rename')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    updateTitle(originalTitle)
  }
}

function openTableCreateDialog(sourceId?: string, baseId?: string) {
  if (!sourceId && !(baseId || basesList.value[0].id)) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'sourceId': sourceId,
    'baseId': baseId || basesList.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const duplicateTable = async (table: TableType) => {
  if (!table || !table.id || !table.base_id) return

  const isOpen = ref(true)

  $e('c:table:duplicate')

  const { close } = useDialog(resolveComponent('DlgTableDuplicate'), {
    'modelValue': isOpen,
    'table': table,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const isCreateTableAllowed = computed(
  () =>
    base.value?.sources?.[0] &&
    isUIAllowed('tableCreate', { source: base.value?.sources?.[0] }) &&
    route.value.name !== 'index' &&
    route.value.name !== 'index-index' &&
    route.value.name !== 'index-index-create' &&
    route.value.name !== 'index-index-create-external' &&
    route.value.name !== 'index-user-index',
)

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  if (isActiveInputElementExist()) {
    return
  }

  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 84: {
        // ALT + T
        if (isCreateTableAllowed.value && !isDrawerOrModalExist()) {
          // prevent the key `T` is inputted to table title input
          e.preventDefault()
          $e('c:shortcut', { key: 'ALT + T' })
          const baseId = activeProjectId.value
          const base = baseId ? bases.value.get(baseId) : undefined
          if (!base) return

          if (baseId) openTableCreateDialog(base.sources?.[0].id, baseId)
        }
        break
      }
      // ALT + L - only show active base
      case 76: {
        if (route.value.params.baseId) {
          router.push({
            query: {
              ...route.value.query,
              clear: route.value.query.clear === '1' ? undefined : '1',
            },
          })
        }
        break
      }
      // ALT + D
      case 68: {
        e.stopPropagation()
        baseCreateDlg.value = true
        break
      }
    }
  }
})

const handleContext = (e: MouseEvent) => {
  if (!document.querySelector('.source-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

provide(TreeViewInj, {
  setMenuContext,
  duplicateTable,
  handleTableRename,
  openViewDescriptionDialog,
  openTableDescriptionDialog,
  contextMenuTarget,
  tableRenameId,
})

useEventListener(document, 'contextmenu', handleContext, true)

const scrollTableNode = () => {
  const activeTableDom = document.querySelector(`.nc-treeview [data-table-id="${_activeTable.value?.id}"]`)
  if (!activeTableDom) return

  // Scroll to the table node
  activeTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const onMove = async (_event: { moved: { newIndex: number; oldIndex: number; element: NcProject } }) => {
  const {
    moved: { newIndex = 0, oldIndex = 0, element },
  } = _event

  if (!element?.id) return

  let nextOrder: number

  // set new order value based on the new order of the items
  if (basesList.value.length - 1 === newIndex) {
    // If moving to the end, set nextOrder greater than the maximum order in the list
    nextOrder = Math.max(...basesList.value.map((item) => item?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    // If moving to the beginning, set nextOrder smaller than the minimum order in the list
    nextOrder = Math.min(...basesList.value.map((item) => item?.order ?? 0)) / 2
  } else {
    nextOrder =
      (parseFloat(String(basesList.value[newIndex - 1]?.order ?? 0)) +
        parseFloat(String(basesList.value[newIndex + 1]?.order ?? 0))) /
      2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  await updateProject(element.id, {
    order: _nextOrder,
  })

  $e('a:base:reorder')
}

watch(
  () => _activeTable.value?.id,
  () => {
    if (!_activeTable.value?.id) return

    // TODO: Find a better way to scroll to the table node
    setTimeout(() => {
      scrollTableNode()
    }, 1000)
  },
  {
    immediate: true,
  },
)

const transitionName = ref<'slide-left' | 'slide-right' | undefined>(undefined)

watch(
  [showProjectList, activeWorkspaceId],
  ([newShowProjectList, newWsId], [_oldShowProjectList, oldWsId]) => {
    if (!isProjectsLoaded.value) {
      transitionName.value = undefined // No animation
      return
    }

    // If workspace changed, skip animation
    if (newWsId !== oldWsId) {
      transitionName.value = undefined // No animation
    } else {
      transitionName.value = newShowProjectList ? 'slide-left' : 'slide-right'
    }
  },
  {
    flush: 'pre',
  },
)

watch([searchInputRef, showProjectList], () => {
  if (!searchInputRef.value || !showProjectList.value) return

  nextTick(() => {
    searchInputRef.value?.input?.focus()
  })
})

watch(isProjectsLoaded, () => {
  if (isProjectsLoaded.value && basesList.value.length) {
    transitionName.value = showProjectList.value ? 'slide-left' : 'slide-right'
  } else {
    transitionName.value = undefined
  }

  if (isProjectsLoaded.value && !basesList.value.length) {
    stopLoading.value = true
    showProjectList.value = true
  }
})
</script>

<template>
  <div
    class="nc-treeview-container relative w-full h-full overflow-hidden flex items-stretch"
    :class="showProjectList ? 'nc-treeview-container-base-list' : 'nc-treeview-container-active-base'"
  >
    <DashboardTreeViewProjectListSkeleton v-if="isLoadingSidebar" />

    <template v-else>
      <Transition :name="transitionName" appear>
        <div
          v-if="showProjectList"
          key="project-list"
          class="nc-treeview-base-list absolute w-full h-full top-0 left-0 z-10 bg-gray-50"
        >
          <div class="w-full">
            <DashboardSidebarHeaderWrapper></DashboardSidebarHeaderWrapper>
            <div class="px-2 h-11 flex items-center">
              <DashboardTreeViewProjectSearchInput ref="searchInputRef" v-model:value="searchQuery" />
            </div>
            <div class="nc-project-home-section pt-1 !pb-2">
              <WorkspaceCreateProjectBtn
                v-model:is-open="isCreateProjectOpen"
                modal
                type="text"
                class="nc-sidebar-create-base-btn nc-project-home-section-item !text-brand-500 !hover:(text-brand-600 bg-none) !xs:hidden w-full"
                data-testid="nc-sidebar-create-base-btn"
              >
              </WorkspaceCreateProjectBtn>
            </div>
          </div>
          <div class="nc-treeview flex-1 relative overflow-auto nc-scrollbar-thin nc-project-home-section">
            <div v-if="!isSharedBase" class="nc-project-home-section-header">{{ $t('objects.projects') }}</div>
            <div mode="inline" class="nc-treeview pb-0.5 flex-grow min-h-50 overflow-x-hidden">
              <div v-if="basesList?.length">
                <Draggable
                  :model-value="basesList"
                  :disabled="isMobileMode || !isUIAllowed('baseReorder') || basesList?.length < 2"
                  item-key="id"
                  handle=".base-title-node"
                  ghost-class="ghost"
                  :filter="isTouchEvent"
                  @change="onMove($event)"
                >
                  <template #item="{ element: baseItem }">
                    <div v-if="searchCompare(baseItem.title, searchQuery)" :key="baseItem.id">
                      <ProjectWrapper :base-role="baseItem.project_role" :base="baseItem">
                        <DashboardTreeViewProjectNode />
                      </ProjectWrapper>
                    </div>
                  </template>
                  <template v-if="!isWorkspaceLoading && !filteredProjectList.length" #footer>
                    <div class="nc-project-home-section-item text-nc-content-gray-muted font-normal">
                      {{ $t('placeholder.noResultsFoundForYourSearch') }}
                    </div>
                  </template>
                </Draggable>
              </div>
              <div v-else class="nc-project-home-section-item text-nc-content-gray-muted font-normal">No Bases</div>
            </div>
          </div>
          <slot name="footer"> </slot>
        </div>
      </Transition>

      <!-- Project Home -->
      <template v-if="!showProjectList">
        <div
          v-if="activeProjectId && openedBase?.id && !openedBase.isLoading"
          class="absolute w-full h-full top-0 left-0 z-5 flex flex-col"
        >
          <ProjectWrapper :base-role="openedBase?.project_role" :base="openedBase">
            <DashboardTreeViewProjectHome>
              <template #footer>
                <slot name="footer"></slot>
              </template>
            </DashboardTreeViewProjectHome>
          </ProjectWrapper>
        </div>
        <DashboardTreeViewProjectListSkeleton v-else />
      </template>

      <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.4s ease, opacity 0.4s ease;
  will-change: transform, opacity;
}

.slide-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-left-enter-to {
  transform: translateX(0);
  opacity: 1;
}
.slide-left-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.slide-left-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-right-enter-to {
  transform: translateX(0);
  opacity: 1;
}
.slide-right-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.slide-right-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.ghost,
.ghost > * {
  @apply pointer-events-none;
}
.ghost {
  @apply bg-primary-selected;
}

:deep(.nc-sidebar-create-base-btn.nc-button.ant-btn-text.theme-default) {
  @apply hover:bg-brand-50 pl-[15px];
}
</style>
