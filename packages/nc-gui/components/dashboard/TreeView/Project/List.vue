<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import ProjectWrapper from '../ProjectWrapper.vue'

const { isUIAllowed } = useRoles()

const { $e, $api } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const basesStore = useBases()

const { createProject: _createProject } = basesStore

const { bases, basesList, activeProjectId, isProjectsLoaded, isProjectsLoading, resolvedProject } = storeToRefs(basesStore)

const { activeWorkspaceId, activeWorkspace } = storeToRefs(useWorkspace())

const { activeSidebarTab } = storeToRefs(useSidebarStore())

const baseCreateDlg = ref(false)

const baseStore = useBase()

const { loadTables } = baseStore

const { base } = storeToRefs(baseStore)

const tablesStore = useTablesStore()

const { loadProjectTables } = tablesStore

const { activeTable: _activeTable } = storeToRefs(tablesStore)

const { setMeta } = useMetas()

const { allRecentViews } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineProjectScope } = useUndoRedo()

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
    await $api.internal.postOperation(
      table.fk_workspace_id!,
      table.base_id!,
      {
        operation: 'tableUpdate',
        tableId: table.id as string,
      },
      {
        base_id: table.base_id,
        table_name: title,
        title,
      },
    )

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
    const newMeta = await $api.internal.getOperation(activeWorkspaceId.value!, activeProjectId.value!, {
      operation: 'tableGet',
      tableId: table.id as string,
    })
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
</script>

<template>
  <div class="nc-treeview-container relative w-full h-full overflow-hidden flex items-stretch nc-treeview-container-active-base">
    <!-- Project Home -->
    <div v-if="resolvedProject?.id && !resolvedProject.isLoading" class="absolute w-full h-full top-0 left-0 z-5 flex flex-col">
      <ProjectWrapper :base-role="resolvedProject?.project_role" :base="resolvedProject">
        <DashboardTreeViewProjectHome>
          <template #footer>
            <slot name="footer"></slot>
          </template>
        </DashboardTreeViewProjectHome>
      </ProjectWrapper>
    </div>

    <div
      v-else-if="isProjectsLoaded && !isProjectsLoading && !basesList.length && activeSidebarTab === 'settings'"
      class="nc-treeview-active-base flex flex-col h-full"
    >
      <div>
        <DashboardSidebarHeaderWrapper>
          <NcTooltip class="truncate font-semibold text-sm text-nc-content-gray" show-on-truncate-only>
            <template #title>{{ activeWorkspace?.title }}</template>
            {{ activeWorkspace?.title }}
          </NcTooltip>
        </DashboardSidebarHeaderWrapper>
      </div>

      <div class="flex-1 relative overflow-y-auto nc-scrollbar-thin">
        <DashboardTreeViewProjectWsSettingsMenu v-if="showWsSettingsInBase" />
      </div>

      <slot name="footer" />
    </div>
    <div v-else-if="isProjectsLoaded && !isProjectsLoading && !basesList.length" class="nc-treeview-empty-state">
      <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('activity.noBasesFound')" class="!mb-1" />

      <WorkspaceCreateProjectBtn type="primary">
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="plus" />
          {{ $t('title.newProj') }}
        </div>
      </WorkspaceCreateProjectBtn>
    </div>
    <DashboardTreeViewProjectListSkeleton v-else />

    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </div>
</template>

<style scoped lang="scss">
.ghost,
.ghost > * {
  @apply pointer-events-none;
}
.ghost {
  @apply bg-primary-selected dark:bg-nc-bg-gray-medium;
}

.nc-treeview-empty-state {
  @apply w-full h-full flex flex-col items-center justify-center p-6 text-nc-content-gray-muted;
}

:deep(.nc-sidebar-create-base-btn.nc-button.ant-btn-text.theme-default) {
  @apply hover:bg-nc-bg-brand pl-[15px];
}
</style>
