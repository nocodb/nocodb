<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
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

const projectsStore = useProjects()

const { createProject: _createProject } = projectsStore

const { projects, projectsList, activeProjectId } = storeToRefs(projectsStore)

const { isWorkspaceLoading } = storeToRefs(useWorkspace())

const { openTable } = useTablesStore()

const projectCreateDlg = ref(false)

const projectStore = useProject()

const { loadTables } = projectStore

const { tables } = storeToRefs(projectStore)

const { activeTable: _activeTable } = storeToRefs(useTablesStore())

const { refreshCommandPalette } = useCommandPalette()

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
  <div class="nc-treeview-container flex flex-col justify-between select-none">
    <div class="text-gray-500 font-medium pl-3.5 mb-1">{{ $t('objects.projects') }}</div>
    <div mode="inline" class="nc-treeview pb-0.5 flex-grow min-h-50 overflow-x-hidden">
      <template v-if="projectsList?.length">
        <ProjectWrapper v-for="project of projectsList" :key="project.id" :project-role="project.project_role" :project="project">
          <DashboardTreeViewProjectNode />
        </ProjectWrapper>
      </template>

      <WorkspaceEmptyPlaceholder v-else-if="!isWorkspaceLoading" />
    </div>
    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" />
  </div>
</template>

<style scoped lang="scss"></style>
