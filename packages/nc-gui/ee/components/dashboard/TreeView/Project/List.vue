<script setup lang="ts">
import Draggable from 'vuedraggable'
import { type ScriptType, type TableType, type ViewType, stringifyRolesObj } from 'nocodb-sdk'
import { useRouter } from '#app'
import ProjectWrapper from '../ProjectWrapper.vue'

const { isUIAllowed } = useRoles()

const { $e, $api } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const { isWorkspaceLoading } = storeToRefs(useWorkspace())

const basesStore = useBases()

const { createProject: _createProject, updateProject } = basesStore

const { bases, basesList, activeProjectId } = storeToRefs(basesStore)

const baseStore = useBase()

const { loadTables } = baseStore

const { isSharedBase, base } = storeToRefs(baseStore)

const { workspaceRoles } = useRoles()

const { updateTab } = useTabs()

const tablesStore = useTablesStore()

const { loadProjectTables } = tablesStore

const { activeTable: _activeTable } = storeToRefs(tablesStore)

const { isMobileMode } = useGlobal()

const { setMeta } = useMetas()

const { allRecentViews } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineProjectScope } = useUndoRedo()

const baseType = ref(NcProjectType.DB)
const baseCreateDlg = ref(false)
const dashboardProjectCreateDlg = ref(false)

const starredProjectList = computed(() => basesList.value.filter((base) => base.starred))
const nonStarredProjectList = computed(() => basesList.value.filter((base) => !base.starred))

const contextMenuTarget = reactive<{ type?: 'base' | 'base' | 'table' | 'main' | 'layout'; value?: any }>({})

const setMenuContext = (type: 'base' | 'base' | 'table' | 'main' | 'layout', value?: any) => {
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

function openAutomationDescriptionDialog(script: ScriptType) {
  if (!script?.id) return

  $e('c:script:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAutomationDescriptionUpdate'), {
    'modelValue': isOpen,
    'script': script,
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

    updateTab({ id: table.id }, { title: newMeta.title })

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
    'sourceId': sourceId, // || sources.value[0].id,
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
        baseType.value = NcProjectType.DB
        baseCreateDlg.value = true
        break
      }
      // // ALT + B
      // case 66: {
      //   e.stopPropagation()
      //   baseType.value = NcProjectType.DOCS
      //   baseCreateDlg.value = true
      //   break
      // }
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
  openAutomationDescriptionDialog,
  openTableDescriptionDialog,
  handleTableRename,
  contextMenuTarget,
  tableRenameId,
})

useEventListener(document, 'contextmenu', handleContext, true)

const onMove = async (
  _event: { moved: { newIndex: number; oldIndex: number; element: NcProject } },
  currentBaseList: NcProject[],
) => {
  const {
    moved: { newIndex = 0, oldIndex = 0, element },
  } = _event

  if (!element?.id) return

  let nextOrder: number

  // set new order value based on the new order of the items
  if (currentBaseList.length - 1 === newIndex) {
    // If moving to the end, set nextOrder greater than the maximum order in the list
    nextOrder = Math.max(...currentBaseList.map((item) => item?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    // If moving to the beginning, set nextOrder smaller than the minimum order in the list
    nextOrder = Math.min(...currentBaseList.map((item) => item?.order ?? 0)) / 2
  } else {
    nextOrder =
      (parseFloat(String(currentBaseList[newIndex - 1]?.order ?? 0)) +
        parseFloat(String(currentBaseList[newIndex + 1]?.order ?? 0))) /
      2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  await updateProject(element.id, {
    order: _nextOrder,
  })

  $e('a:base:reorder')
}
</script>

<template>
  <div>
    <DashboardSidebarHeaderWrapper></DashboardSidebarHeaderWrapper>

    <div class="nc-treeview-container flex flex-col justify-between select-none pl-0.5">
      <div ref="treeViewDom" mode="inline" class="nc-treeview pb-0.5 flex-grow h-full overflow-hidden h-full">
        <template v-if="starredProjectList?.length">
          <div v-if="!isSharedBase" class="nc-treeview-subheading mt-1">
            <div class="text-gray-500 font-medium">Starred</div>
          </div>
          <div>
            <Draggable
              :model-value="starredProjectList"
              :disabled="isMobileMode || !isUIAllowed('baseReorder') || starredProjectList?.length < 2"
              item-key="starred-project"
              handle=".base-title-node"
              ghost-class="ghost"
              :filter="isTouchEvent"
              @change="onMove($event, starredProjectList)"
            >
              <template #item="{ element: baseItem }">
                <div :key="baseItem.id">
                  <ProjectWrapper :base-role="baseItem.project_role || baseItem.workspace_role" :base="baseItem">
                    <DashboardTreeViewProjectNode />
                  </ProjectWrapper>
                </div>
              </template>
            </Draggable>
          </div>
        </template>
        <div v-if="!isSharedBase" class="nc-treeview-subheading mt-1">
          <div class="text-gray-500 font-medium">{{ $t('objects.projects') }}</div>
        </div>
        <div v-if="nonStarredProjectList?.length">
          <Draggable
            v-model="nonStarredProjectList"
            :disabled="isMobileMode || !isUIAllowed('baseReorder') || nonStarredProjectList?.length < 2"
            item-key="non-starred-project"
            handle=".base-title-node"
            ghost-class="ghost"
            :filter="isTouchEvent"
            @change="onMove($event, nonStarredProjectList)"
          >
            <template #item="{ element: baseItem }">
              <div :key="baseItem.id">
                <ProjectWrapper :base-role="baseItem.project_role || stringifyRolesObj(workspaceRoles)" :base="baseItem">
                  <DashboardTreeViewProjectNode />
                </ProjectWrapper>
              </div>
            </template>
          </Draggable>
        </div>

        <WorkspaceEmptyPlaceholder v-else-if="!basesList.length && !isWorkspaceLoading" />
      </div>

      <WorkspaceCreateProjectDlg v-model="baseCreateDlg" :type="baseType" />
      <WorkspaceCreateDashboardProjectDlg v-model="dashboardProjectCreateDlg" />
    </div>
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
  @apply bg-primary-selected;
}
</style>
