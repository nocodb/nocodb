<script setup lang="ts">
import { type DashboardType, type ScriptType, type TableType, type ViewType, extractBaseRoleFromWorkspaceRole } from 'nocodb-sdk'
import ProjectWrapper from '../ProjectWrapper.vue'
import { useRouter } from '#app'

const { isUIAllowed } = useRoles()

const { $e, $api } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const { activeWorkspaceId, activeWorkspace } = storeToRefs(useWorkspace())

const basesStore = useBases()

const { createProject: _createProject } = basesStore

const { bases, basesList, activeProjectId, isProjectsLoaded, isProjectsLoading } = storeToRefs(basesStore)

const { activeSidebarTab } = storeToRefs(useSidebarStore())

const baseStore = useBase()

const { loadTables } = baseStore

const { base } = storeToRefs(baseStore)

const { workspaceRoles } = useRoles()

const tablesStore = useTablesStore()

const { loadProjectTables } = tablesStore

const { activeTable: _activeTable } = storeToRefs(tablesStore)

const { setMeta } = useMetas()

const { allRecentViews } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineProjectScope } = useUndoRedo()

const baseCreateDlg = ref(false)

const openedBase = computed(() => {
  return basesList.value.find((b) => b.id === activeProjectId.value)
})

const isWsAdminRoute = computed(() => route.value.name === 'index-typeOrId-settings-page')

// On ws-admin routes without a baseId, resolve a base from last visited or first available
const resolvedBaseForAdmin = computed(() => {
  if (openedBase.value) return openedBase.value
  if (!isWsAdminRoute.value) return undefined

  const lastVisitedBaseId = ncLastVisitedBase().get()
  return basesList.value.find((b) => b.id === lastVisitedBaseId) || basesList.value[0]
})

const effectiveBase = computed(() => openedBase.value || resolvedBaseForAdmin.value)

const contextMenuTarget = reactive<{ type?: 'base' | 'base' | 'table' | 'main'; value?: any }>({})

const setMenuContext = (type: 'base' | 'base' | 'table' | 'main', value?: any) => {
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

function openScriptDescriptionDialog(script: ScriptType) {
  if (!script?.id) return

  $e('c:script:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgScriptDescriptionUpdate'), {
    'modelValue': isOpen,
    'script': script,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openDashboardDescriptionDialog(dashboard: DashboardType) {
  if (!dashboard?.id) return

  $e('c:dashboard:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgDashboardDescriptionUpdate'), {
    'modelValue': isOpen,
    'dashboard': dashboard,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openWorkflowDescriptionDialog(workflow: WorkflowType) {
  if (!workflow?.id) return

  $e('c:workflow:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgWorkflowDescriptionUpdate'), {
    'modelValue': isOpen,
    'workflow': workflow,
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
    base.value.sources?.[0] &&
    isUIAllowed('tableCreate', { source: base.value.sources?.[0] }) &&
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
  if (!document.querySelector('.base-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

provide(TreeViewInj, {
  setMenuContext,
  duplicateTable,
  openViewDescriptionDialog,
  openScriptDescriptionDialog,
  openDashboardDescriptionDialog,
  openWorkflowDescriptionDialog,
  openTableDescriptionDialog,
  handleTableRename,
  contextMenuTarget,
  tableRenameId,
})

useEventListener(document, 'contextmenu', handleContext, true)
</script>

<template>
  <div class="nc-treeview-container relative w-full h-full overflow-hidden flex items-stretch nc-treeview-container-active-base">
    <template v-if="effectiveBase?.id && !effectiveBase.isLoading">
      <div class="absolute w-full h-full top-0 left-0 z-5 flex flex-col">
        <ProjectWrapper
          :base-role="effectiveBase?.project_role || extractBaseRoleFromWorkspaceRole(workspaceRoles)"
          :base="effectiveBase"
        >
          <DashboardTreeViewProjectHome>
            <template #footer>
              <slot name="footer"></slot>
            </template>
          </DashboardTreeViewProjectHome>
        </ProjectWrapper>
      </div>

      <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
    </template>

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
        <DashboardTreeViewProjectWsSettingsMenu />
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
  </div>
</template>

<style scoped lang="scss">
.nc-treeview-subheading {
  @apply flex flex-row w-full justify-between items-center mb-1.5 pl-3.5 pr-0.5;
}
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
