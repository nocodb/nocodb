<script setup lang="ts">
import Draggable from 'vuedraggable'
import { type TableType, stringifyRolesObj } from 'nocodb-sdk'
import ProjectWrapper from './ProjectWrapper.vue'
import {
  TreeViewInj,
  computed,
  isDrawerOrModalExist,
  isMac,
  reactive,
  ref,
  resolveComponent,
  storeToRefs,
  useBase,
  useBases,
  useDialog,
  useNuxtApp,
  useRoles,
  useTablesStore,
} from '#imports'

import { useRouter } from '#app'

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const { isWorkspaceLoading } = storeToRefs(useWorkspace())

const basesStore = useBases()

const { createProject: _createProject, updateProject } = basesStore

const { bases, basesList, activeProjectId } = storeToRefs(basesStore)

const baseStore = useBase()

const { isSharedBase } = storeToRefs(baseStore)

const { activeTable: _activeTable } = storeToRefs(useTablesStore())

const { workspaceRoles } = useRoles()

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

function openRenameTableDialog(table: TableType, _rightClick = false) {
  if (!table || !table.source_id) return

  $e('c:table:rename')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'sourceId': table.source_id, // || sources.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
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
    isUIAllowed('tableCreate') &&
    route.value.name !== 'index' &&
    route.value.name !== 'index-index' &&
    route.value.name !== 'index-index-create' &&
    route.value.name !== 'index-index-create-external' &&
    route.value.name !== 'index-user-index',
)

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
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
      // ALT + B
      case 66: {
        e.stopPropagation()
        baseType.value = NcProjectType.DOCS
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
  openRenameTableDialog,
  contextMenuTarget,
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

  // set default order value as 0 if item not found
  const previousItem = currentBaseList[newIndex - 1]?.order ? { order: currentBaseList[newIndex - 1].order } : { order: 0 }
  const nextItem = currentBaseList[newIndex + 1]?.order ? { order: currentBaseList[newIndex + 1].order } : { order: 0 }

  let nextOrder: number

  // set new order value based on the new order of the items
  if (currentBaseList.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  await updateProject(element.id, {
    order: _nextOrder,
  })

  $e('a:base:reorder')
}
</script>

<template>
  <div class="nc-treeview-container flex flex-col justify-between select-none pl-0.5">
    <div ref="treeViewDom" mode="inline" class="nc-treeview pb-0.5 flex-grow h-full overflow-hidden h-full">
      <template v-if="starredProjectList?.length">
        <div v-if="!isSharedBase" class="nc-treeview-subheading mt-1">
          <div class="text-gray-500 font-medium">Starred</div>
        </div>
        <div>
          <Draggable
            :model-value="starredProjectList"
            :disabled="!isUIAllowed('baseReorder') || starredProjectList?.length < 2"
            item-key="starred-project"
            handle=".base-title-node"
            ghost-class="ghost"
            @change="onMove($event, starredProjectList)"
          >
            <template #item="{ element: base }">
              <div :key="base.id">
                <ProjectWrapper :base-role="base.project_role || base.workspace_role" :base="base">
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
          :disabled="!isUIAllowed('baseReorder') || nonStarredProjectList?.length < 2"
          item-key="non-starred-project"
          handle=".base-title-node"
          ghost-class="ghost"
          @change="onMove($event, nonStarredProjectList)"
        >
          <template #item="{ element: base }">
            <div :key="base.id">
              <ProjectWrapper :base-role="base.project_role || stringifyRolesObj(workspaceRoles)" :base="base">
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
