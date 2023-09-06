<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { stringifyRolesObj } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import ProjectWrapper from './ProjectWrapper.vue'
import type { TabType } from '#imports'
import {
  TreeViewInj,
  computed,
  isDrawerOrModalExist,
  isElementInvisible,
  isMac,
  reactive,
  ref,
  resolveComponent,
  storeToRefs,
  useDialog,
  useNuxtApp,
  useProject,
  useProjects,
  useTablesStore,
  useTabs,
  useUIPermission,
} from '#imports'

import { useRouter } from '#app'

const { isUIAllowed } = useUIPermission()

const { addTab } = useTabs()

const { $e, $jobs } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const { isWorkspaceLoading } = storeToRefs(useWorkspace())

const projectsStore = useProjects()

const { createProject: _createProject } = projectsStore

const { projects, projectsList, activeProjectId } = storeToRefs(projectsStore)

const { openTable } = useTablesStore()

const projectStore = useProject()

const { loadTables } = projectStore

const { tables, isSharedBase } = storeToRefs(projectStore)

const { activeTable: _activeTable, projectTables } = storeToRefs(useTablesStore())

const { refreshCommandPalette } = useCommandPalette()

const { workspaceRoles } = useRoles()

const keys = ref<Record<string, number>>({})

const menuRefs = ref<HTMLElement[] | HTMLElement>()

const projectType = ref(NcProjectType.DB)
const projectCreateDlg = ref(false)
const dashboardProjectCreateDlg = ref(false)

// const activeTable = computed(() => ([TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.id : null))

const tablesById = computed(() =>
  Object.values(projectTables.value.get(activeProjectId.value!) || {})
    .flat()
    ?.reduce<Record<string, TableType>>((acc, table) => {
      acc[table.id!] = table

      return acc
    }, {}),
)

const nonStarredProjectList = computed(() => projectsList.value.filter((project) => !project.starred))
const starredProjectList = computed(() => projectsList.value.filter((project) => project.starred))

const sortables: Record<string, Sortable> = {}

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  const base_id = el.getAttribute('nc-base')
  if (!base_id) return
  if (sortables[base_id]) sortables[base_id].destroy()
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      const offset = tables.value.findIndex((table) => table.base_id === base_id)

      const { newIndex = 0, oldIndex = 0 } = evt

      const itemEl = evt.item as HTMLLIElement
      const item = tablesById.value[itemEl.dataset.id as string]

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLLIElement
      const itemAfterEl = children[newIndex + 1] as HTMLLIElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && tablesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && tablesById.value[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === evt.newIndex) {
        item.order = (itemBefore.order as number) + 1
      } else if (newIndex === 0) {
        item.order = (itemAfter.order as number) / 2
      } else {
        item.order = ((itemBefore.order as number) + (itemAfter.order as number)) / 2
      }

      // update the order of the moved item
      tables.value?.splice(newIndex + offset, 0, ...tables.value?.splice(oldIndex + offset, 1))

      // force re-render the list
      if (keys.value[base_id]) {
        keys.value[base_id] = keys.value[base_id] + 1
      } else {
        keys.value[base_id] = 1
      }

      // update the item order
      await $api.dbTable.reorder(item.id as string, {
        order: item.order,
      })
    },
    animation: 150,
  })
}

watchEffect(() => {
  if (menuRefs.value) {
    if (menuRefs.value instanceof HTMLElement) {
      initSortable(menuRefs.value)
    } else {
      menuRefs.value.forEach((el) => initSortable(el))
    }
  }
})

const contextMenuTarget = reactive<{ type?: 'project' | 'base' | 'table' | 'main' | 'layout'; value?: any }>({})

const setMenuContext = (type: 'project' | 'base' | 'table' | 'main' | 'layout', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

function openRenameTableDialog(table: TableType, rightClick = false) {
  if (!table || !table.base_id) return

  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'baseId': table.base_id, // || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateDialog(baseId?: string, projectId?: string) {
  if (!baseId && !(projectId || projectsList.value[0].id)) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
    'projectId': projectId || projectsList.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const duplicateTable = async (table: TableType) => {
  if (!table || !table.id || !table.project_id) return

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableDuplicate'), {
    'modelValue': isOpen,
    'table': table,
    'onOk': async (jobData: { id: string }) => {
      $jobs.subscribe({ id: jobData.id }, undefined, async (status: string, data?: any) => {
        if (status === JobStatus.COMPLETED) {
          await loadTables()
          refreshCommandPalette()
          const newTable = tables.value.find((el) => el.id === data?.result?.id)
          if (newTable) addTab({ title: newTable.title, id: newTable.id, type: newTable.type as TabType })

          openTable(newTable!)
        } else if (status === JobStatus.FAILED) {
          message.error('Failed to duplicate table')
          await loadTables()
        }
      })

      $e('a:table:duplicate')
    },
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const isCreateTableAllowed = computed(
  () =>
    isUIAllowed('table-create') &&
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
          const projectId = activeProjectId.value
          const project = projectId ? projects.value.get(projectId) : undefined
          if (!project) return

          if (projectId) openTableCreateDialog(project.bases?.[0].id, projectId)
        }
        break
      }
      // ALT + L - only show active project
      case 76: {
        if (route.value.params.projectId) {
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
        projectType.value = NcProjectType.DB
        projectCreateDlg.value = true
        break
      }
      // ALT + B
      case 66: {
        e.stopPropagation()
        projectType.value = NcProjectType.DOCS
        projectCreateDlg.value = true
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

const scrollTableNode = () => {
  const activeTableDom = document.querySelector(`.nc-treeview [data-table-id="${_activeTable.value?.id}"]`)
  if (!activeTableDom) return

  if (isElementInvisible(activeTableDom)) {
    // Scroll to the table node
    activeTableDom?.scrollIntoView({ behavior: 'smooth' })
  }
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

watch(
  activeProjectId,
  () => {
    const activeProjectDom = document.querySelector(`.nc-treeview [data-project-id="${activeProjectId.value}"]`)
    if (!activeProjectDom) return

    if (isElementInvisible(activeProjectDom)) {
      // Scroll to the table node
      activeProjectDom?.scrollIntoView({ behavior: 'smooth' })
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="nc-treeview-container flex flex-col justify-between select-none px-0.5">
    <div ref="treeViewDom" mode="inline" class="nc-treeview pb-0.5 flex-grow h-full overflow-hidden h-full">
      <template v-if="starredProjectList?.length">
        <div v-if="!isSharedBase" class="nc-treeview-subheading mt-1">
          <div class="text-gray-500 font-medium">Starred</div>
        </div>
        <ProjectWrapper
          v-for="project of starredProjectList"
          :key="project.id"
          :project-role="project.project_role || project.workspace_role"
          :project="project"
        >
          <DashboardTreeViewProjectNode />
        </ProjectWrapper>
      </template>
      <div v-if="!isSharedBase" class="nc-treeview-subheading mt-2.5">
        <div class="text-gray-500 font-medium">{{ $t('objects.projects') }}</div>
        <WorkspaceCreateProjectBtn
          v-model:is-open="isCreateProjectOpen"
          modal
          type="text"
          size="xxsmall"
          class="!hover:bg-gray-200 !hover-text-gray-800 !text-gray-600"
          :centered="true"
          data-testid="nc-sidebar-create-project-btn-small"
        >
          <GeneralIcon icon="plus" class="text-lg leading-6" style="-webkit-text-stroke: 0.2px" />
        </WorkspaceCreateProjectBtn>
      </div>
      <template v-if="nonStarredProjectList?.length">
        <ProjectWrapper
          v-for="project of nonStarredProjectList"
          :key="project.id"
          :project-role="project.project_role || stringifyRolesObj(workspaceRoles)"
          :project="project"
        >
          <DashboardTreeViewProjectNode />
        </ProjectWrapper>
      </template>

      <WorkspaceEmptyPlaceholder v-else-if="!starredProjectList.length && !isWorkspaceLoading" />
    </div>

    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
    <WorkspaceCreateDashboardProjectDlg v-model="dashboardProjectCreateDlg" />
    <!-- <div class="flex flex-col border-t-1 border-gray-100">
      <div class="flex items-center mt-3 justify-center mx-2">
        <WorkspaceCreateProjectBtn
          modal
          type="ghost"
          class="h-auto w-full nc-create-project-btn !rounded-lg"
          :active-workspace-id="route.params.typeOrId"
        >
          <div class="flex flex-row justify-between w-full items-center">
            <div class="flex">Create new Project</div>
            <MaterialSymbolsAddRounded />
          </div>
        </WorkspaceCreateProjectBtn>
      </div>
      <div class="flex items-start flex-row justify-center px-2 pt-1 pb-1.5 gap-2">
        <GeneralJoinCloud class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />
      </div>
    </div> -->
  </div>
</template>

<style scoped lang="scss">
.nc-treeview-subheading {
  @apply flex flex-row w-full justify-between items-center mb-1.5 pl-3.5 pr-1.25;
}

.nc-treeview-container {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  & .dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition hover:!bg-transparent;
  }

  .sortable-chosen {
    @apply !bg-primary bg-opacity-25 text-primary;
  }
}
</style>
