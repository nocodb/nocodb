<script setup lang="ts">
import type { BaseType, ProjectType, TableType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import Sortable from 'sortablejs'
import AddNewTableNode from './AddNewTableNode'
import TableList from './TableList'
import ProjectWrapper from './ProjectWrapper.vue'

import {
  TabType,
  TreeViewFunctions,
  computed,
  isDrawerOrModalExist,
  isMac,
  reactive,
  ref,
  resolveComponent,
  storeToRefs,
  useDialog,
  useNuxtApp,
  useProject,
  useProjects,
  useTable,
  useTablesStore,
  useTabs,
  useToggle,
  useUIPermission,
  watchEffect,
} from '#imports'

import { useRouter } from '#app'
import type { NcProject } from '~~/lib'

const { addTab, addSqlEditorTab } = useTabs()

const { $api, $e, $jobs } = useNuxtApp()

const router = useRouter()

const route = $(router.currentRoute)

const { projectUrl } = useProject()

const projectsStore = useProjects()

const { loadProject, createProject: _createProject } = projectsStore

const { loadProjectTables } = useTablesStore()

const { projects, projectsList } = storeToRefs(projectsStore)

const { projectTables } = storeToRefs(useTablesStore())

const { getDashboardProjectUrl: dashboardProjectUrl } = useDashboardStore()

const activeProjectId = computed(() => route.params.projectId as string | undefined)

const projectElRefs = ref()

const { projectUrl: docsProjectUrl } = useDocStore()

const loadProjectAndTableList = async (project: NcProject) => {
  if (!project) {
    return
  }

  project.isExpanded = !project.isExpanded

  // if dashboard or document project, add a document tab and route to the respective page
  switch (project.type) {
    case 'dashboard':
      addTab({
        id: project.id,
        title: project.title!,
        type: TabType.LAYOUT,
        projectId: project.id,
      })
      $e('c:dashboard:open', project.id)
      navigateTo(dashboardProjectUrl(project.id!))
      break
    case 'documentation':
      addTab({
        id: project.id,
        title: project.title!,
        type: TabType.DOCUMENT,
        projectId: project.id,
      })
      $e('c:document:open', project.id)
      navigateTo(docsProjectUrl(project.id!))
      break
    case 'database':
      await navigateTo(
        projectUrl({
          id: project.id!,
          type: 'database',
        }),
      )
      await loadProject(project.id!)
      await loadProjectTables(project.id!)
      break
    default:
      throw new Error(`Unknown project type: ${project.type}`)
  }
}

const projectStore = useProject()

const { loadTables } = projectStore

const { isSharedBase, tables } = storeToRefs(projectStore)

const { activeTab } = storeToRefs(useTabs())

const { deleteTable } = useTable()

const { isUIAllowed } = useUIPermission()

const [searchActive] = useToggle()

const keys = $ref<Record<string, number>>({})

const activeKey = ref<string[]>([])

const menuRefs = $ref<HTMLElement[] | HTMLElement>()

const filterQuery = $ref('')

const activeTable = computed(() => ([TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.id : null))

const tablesById = $computed(() =>
  Object.values(projectTables.value.get(activeProjectId.value!) || {})
    .flat()
    ?.reduce<Record<string, TableType>>((acc, table) => {
      acc[table.id!] = table

      return acc
    }, {}),
)

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
      const item = tablesById[itemEl.dataset.id as string]

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLLIElement
      const itemAfterEl = children[newIndex + 1] as HTMLLIElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && tablesById[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && tablesById[itemAfterEl.dataset.id as string]

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
      if (keys[base_id]) {
        keys[base_id] = keys[base_id] + 1
      } else {
        keys[base_id] = 1
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
  if (menuRefs) {
    if (menuRefs instanceof HTMLElement) {
      initSortable(menuRefs)
    } else {
      menuRefs.forEach((el) => initSortable(el))
    }
  }
})

const contextMenuTarget = reactive<{ type?: 'project' | 'base' | 'table' | 'main' | 'layout'; value?: any }>({})

const setMenuContext = (type: 'project' | 'base' | 'table' | 'main' | 'layout', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

const reloadTables = async () => {
  $e('a:table:refresh:navdraw')

  // await loadTables()
}

function openRenameTableDialog(table: TableType, rightClick = false) {
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

// function openQuickImportDialog(type: string, baseId?: string) {
//   $e(`a:actions:import-${type}`)

//   const isOpen = ref(true)

//   const { close } = useDialog(resolveComponent('DlgQuickImport'), {
//     'modelValue': isOpen,
//     'importType': type,
//     'baseId': baseId, // || bases.value[0].id,
//     'onUpdate:modelValue': closeDialog,
//   })

//   function closeDialog() {
//     isOpen.value = false

//     close(1000)
//   }
// }

// function openAirtableImportDialog(baseId?: string) {
//   $e('a:actions:import-airtable')

//   const isOpen = ref(true)

//   const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
//     'modelValue': isOpen,
//     'baseId': baseId, // || bases.value[0].id,
//     'onUpdate:modelValue': closeDialog,
//   })

//   function closeDialog() {
//     isOpen.value = false

//     close(1000)
//   }
// }

function openTableCreateDialog(baseId?: string, projectId?: string) {
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

// function openTableCreateMagicDialog(baseId?: string) {
//   $e('c:table:create:navdraw')

//   const isOpen = ref(true)

//   const { close } = useDialog(resolveComponent('DlgTableMagic'), {
//     'modelValue': isOpen,
//     'baseId': baseId, // || bases.value[0].id,
//     'onUpdate:modelValue': closeDialog,
//   })

//   function closeDialog() {
//     isOpen.value = false

//     close(1000)
//   }
// }

// function openSchemaMagicDialog(baseId?: string) {
//   $e('c:table:create:navdraw')

//   const isOpen = ref(true)

//   const { close } = useDialog(resolveComponent('DlgSchemaMagic'), {
//     'modelValue': isOpen,
//     'baseId': baseId, // || bases.value[0].id,
//     'onUpdate:modelValue': closeDialog,
//   })

//   function closeDialog() {
//     isOpen.value = false

//     close(1000)
//   }
// }

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
          const newTable = tables.value.find((el) => el.id === data?.result?.id)
          if (newTable) addTab({ title: newTable.title, id: newTable.id, type: newTable.type as TabType })
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

function openSqlEditor(base: BaseType) {
  addSqlEditorTab(projects.value.get(base.project_id!)!)
}

function openErdView(base: BaseType) {
  navigateTo(`/ws/${route.params.workspaceId}/nc/${base.project_id}/erd/${base.id}`)
}

async function openProjectSqlEditor(project: ProjectType) {
  if (!project.id) return
  navigateTo(`/ws/${route.params.workspaceId}/nc/${project.id}/sql`)
}

async function openProjectErdView(_project: ProjectType) {
  if (!_project.id) return

  const project = projects.value.get(_project.id)
  if (!project) await loadProject(_project.id!)

  const base = project?.bases?.[0]
  if (!base) return
  navigateTo(`/ws/${route.params.workspaceId}/nc/${base.project_id}/erd/${base.id}`)
}

// const searchInputRef: VNodeRef = (vnode: typeof Input) => vnode?.$el?.focus()

// const beforeSearch = ref<string[]>([])
//
// const onSearchCloseIconClick = () => {
//   filterQuery = ''
//   toggleSearchActive(false)
//   activeKey.value = beforeSearch.value
// }
//
// const onSearchIconClick = () => {
//   beforeSearch.value = activeKey.value
//   toggleSearchActive(true)
//   activeKey.value = bases.value.filter((el) => el.enabled).map((el) => `collapse-${el.id}`)
// }

const isCreateTableAllowed = computed(
  () =>
    isUIAllowed('table-create') &&
    route.name !== 'index' &&
    route.name !== 'index-index' &&
    route.name !== 'index-index-create' &&
    route.name !== 'index-index-create-external' &&
    route.name !== 'index-user-index',
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
        if (route.params.projectId) {
          router.push({
            query: {
              ...route.query,
              clear: route.query.clear === '1' ? undefined : '1',
            },
          })
        }
        break
      }
    }
  }
})

watch(
  activeTable,
  (value, oldValue) => {
    if (value) {
      if (value !== oldValue) {
        // const fndTable = tables.value.find((el) => el.id === value)
        // if (fndTable) {
        //   activeKey.value = [`collapse-${fndTable.base_id}`]
        // }
      }
    } else {
      // if (bases.value.filter((el) => el.enabled)[0]?.id)
      //   activeKey.value = [`collapse-${bases.value.filter((el) => el.enabled)[0].id}`]
    }
  },
  { immediate: true },
)

// const setIcon = async (icon: string, table: TableType) => {
//   try {
//     table.meta = {
//       ...(table.meta || {}),
//       icon,
//     }
//     tables.value.splice(tables.value.indexOf(table), 1, { ...table })

//     updateTab({ id: table.id }, { meta: table.meta })

//     $api.dbTable.update(table.id as string, {
//       meta: table.meta,
//     })

//     $e('a:table:icon:navdraw', { icon })
//   } catch (e) {
//     message.error(await extractSdkResponseErrorMsg(e))
//   }
// }

const handleContext = (e: MouseEvent) => {
  if (!document.querySelector('.base-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

provide(TreeViewFunctions, {
  setMenuContext,
  duplicateTable,
  openRenameTableDialog,
})

useEventListener(document, 'contextmenu', handleContext, true)

watch(
  () => route.params.projectId,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      await loadProject(newId as string)
      await loadProjectTables(newId as string)
    }
  },
  { immediate: true },
)

// If only project is open, i.e in case of docs, project view is open and not the page view
const projectViewOpen = computed(() => {
  const routeNameSplit = String(route?.name).split('projectId-index-index')
  if (routeNameSplit.length <= 1) return false

  const routeNameAfterProjectView = routeNameSplit[routeNameSplit.length - 1]
  return routeNameAfterProjectView.split('-').length === 2 || routeNameAfterProjectView.split('-').length === 1
})
</script>

<template>
  <div class="nc-treeview-container flex flex-col justify-between">
    <div mode="inline" class="nc-treeview flex-grow min-h-50 overflow-y-auto overflow-x-hidden">
      <template v-if="projectsList?.length">
        <ProjectWrapper
          v-for="project of projectsList"
          :key="project.id"
          :project-role="[project.project_role, project.role]"
          :project="project"
        >
          <a-dropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
            <div ref="projectElRefs" class="mx-1 nc-project-sub-menu rounded-md" :class="{ active: project.isExpanded }">
              <div
                class="flex items-center gap-0.75 py-0.25 cursor-pointer"
                @click="loadProjectAndTableList(project)"
                @contextmenu="setMenuContext('project', project)"
              >
                <DashboardTreeViewNewProjectNode
                  ref="projectNodeRefs"
                  class="flex-grow rounded-md pl-2"
                  :class="{
                    'bg-primary-selected': activeProjectId === project.id && projectViewOpen,
                    'hover:bg-hover': !(activeProjectId === project.id && projectViewOpen),
                  }"
                />
              </div>

              <div
                v-if="project.id"
                key="g1"
                class="overflow-y-auto overflow-x-hidden transition-max-height"
                :class="{ 'max-h-0': !project.isExpanded, 'max-h-500': project.isExpanded }"
              >
                <div v-if="project.type === 'documentation'">
                  <DocsSideBar v-if="project.isExpanded" :project="project" />
                </div>
                <div v-else-if="project.type === 'dashboard'">
                  <LayoutsSideBar v-if="project.isExpanded" :project="project" />
                </div>
                <template v-else-if="project && project?.bases">
                  <div class="pt-1.5 pl-6 pb-1 flex-1 overflow-y-auto flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
                    <div
                      v-if="project?.bases?.[0]?.enabled && !project?.bases?.slice(1).filter((el) => el.enabled)?.length"
                      class="flex-1 ml-1"
                    >
                      <AddNewTableNode
                        :project="project"
                        :base-index="0"
                        @open-table-create-dialog="openTableCreateDialog(project?.bases?.[0].id, project.id)"
                      />

                      <div class="transition-height duration-200">
                        <TableList :project="project" :base-index="0" />
                      </div>
                    </div>

                    <div v-else class="transition-height duration-200">
                      <div class="border-none sortable-list">
                        <div v-for="(base, baseIndex) of project.bases" :key="`base-${base.id}`">
                          <a-collapse
                            v-if="base && base.enabled"
                            v-model:activeKey="activeKey"
                            :class="[{ hidden: searchActive && !!filterQuery }]"
                            expand-icon-position="right"
                            :bordered="false"
                            :accordion="!searchActive"
                            ghost
                          >
                            <a-collapse-panel :key="`collapse-${base.id}`">
                              <template #header>
                                <div
                                  v-if="baseIndex === 0"
                                  class="base-context flex items-center gap-2 text-gray-500 font-bold"
                                  @contextmenu="setMenuContext('base', base)"
                                >
                                  <GeneralBaseLogo :base-type="base.type" />
                                  Default ({{
                                    projectTables.get(project.id)?.filter((table) => table.base_id === base.id).length || '0'
                                  }})
                                </div>
                                <div
                                  v-else
                                  class="base-context flex items-center gap-2 text-gray-500 font-bold"
                                  @contextmenu="setMenuContext('base', base)"
                                >
                                  <GeneralBaseLogo :base-type="base.type" />
                                  {{ base.alias || '' }}
                                  ({{
                                    projectTables.get(project.id)?.filter((table) => table.base_id === base.id).length || '0'
                                  }})
                                </div>
                              </template>
                              <AddNewTableNode
                                :project="project"
                                :base-index="baseIndex"
                                @open-table-create-dialog="openTableCreateDialog(base.id, project.id)"
                              />

                              <div
                                ref="menuRefs"
                                :key="`sortable-${base.id}-${base.id && base.id in keys ? keys[base.id] : '0'}`"
                                :nc-base="base.id"
                              >
                                <TableList class="pl-2" :project="project" :base-index="baseIndex" />
                              </div>
                            </a-collapse-panel>
                          </a-collapse>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <template v-if="!isSharedBase" #overlay>
              <a-menu class="!py-0 rounded text-sm">
                <template v-if="contextMenuTarget.type === 'project' && project.type === 'database'">
                  <a-menu-item v-if="isUIAllowed('sqlEditor')" @click="openProjectSqlEditor(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">SQL Editor</div>
                  </a-menu-item>

                  <a-menu-item @click="openProjectErdView(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">ERD View</div>
                  </a-menu-item>
                </template>

                <template v-else-if="contextMenuTarget.type === 'base'">
                  <a-menu-item v-if="isUIAllowed('sqlEditor')" @click="openSqlEditor(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">SQL Editor</div>
                  </a-menu-item>

                  <a-menu-item @click="openErdView(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">ERD View</div>
                  </a-menu-item>
                </template>

                <template v-else-if="contextMenuTarget.type === 'table'">
                  <a-menu-item v-if="isUIAllowed('table-rename')" @click="openRenameTableDialog(contextMenuTarget.value, true)">
                    <div class="nc-project-menu-item">
                      {{ $t('general.rename') }}
                    </div>
                  </a-menu-item>

                  <a-menu-item v-if="isUIAllowed('table-duplicate')" @click="duplicateTable(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">
                      {{ $t('general.duplicate') }}
                    </div>
                  </a-menu-item>

                  <a-menu-item v-if="isUIAllowed('table-delete')" @click="deleteTable(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">
                      {{ $t('general.delete') }}
                    </div>
                  </a-menu-item>
                </template>

                <template v-else>
                  <a-menu-item @click="reloadTables">
                    <div class="nc-project-menu-item">
                      {{ $t('general.reload') }}
                    </div>
                  </a-menu-item>
                </template>
              </a-menu>
            </template>
          </a-dropdown>
        </ProjectWrapper>
      </template>

      <WorkspaceEmptyPlaceholder v-else />
    </div>

    <div class="flex flex-col">
      <a-divider class="!my-0" />
      <div class="flex items-center mt-4 justify-center mx-2">
        <WorkspaceCreateProjectBtn
          modal
          type="ghost"
          class="h-auto w-full nc-create-project-btn !rounded-lg"
          :active-workspace-id="route.params.workspaceId"
        >
          <PhPlusThin />
          Create new Project
        </WorkspaceCreateProjectBtn>
      </div>
      <div class="flex items-start flex-row justify-center px-2 py-3 gap-2">
        <GeneralJoinCloud class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-treeview-container {
  height: calc(100% - var(--header-height));
}

.nc-treeview-footer-item {
  @apply cursor-pointer px-4 py-2 flex items-center hover:bg-gray-200/20 text-xs text-current;
}

:deep(.nc-filter-input input::placeholder) {
  @apply !text-xs;
}

:deep(.ant-dropdown-menu-title-content) {
  @apply !p-2;
}

:deep(.ant-input-group-addon:last-child) {
  @apply top-[-0.5px];
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

.nc-tree-item:hover {
  @apply text-primary after:(!opacity-5);
}

:deep(.nc-filter-input) {
  .ant-input {
    @apply pr-6 !border-0;
  }
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply !mx-0;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply m-0;
}

:deep(.ant-dropdown-menu-item) {
  @apply !py-0 active:(ring ring-accent ring-opacity-100);
}

:deep(.ant-dropdown-menu-title-content) {
  @apply !p-0;
}

:deep(.ant-collapse-content-box) {
  @apply !p-0;
}

:deep(.ant-collapse-header) {
  @apply !border-0;
}

:deep(.ant-menu-sub.ant-menu-inline .ant-menu-item-group-title) {
  @apply !py-0;
}

:deep(.nc-project-sub-menu .ant-menu-submenu-title) {
  @apply !pr-1 !pl-3;
}

:deep(.ant-menu-inline .ant-menu-submenu-title) {
  @apply !h-28px;
}

:deep(.nc-project-sub-menu.active) {
}

.nc-create-project-btn {
  @apply px-2;
  :deep(.ant-btn) {
    @apply w-full !text-center justify-center h-auto rounded py-2 px-4 border-gray-200;
    & > div {
      @apply !justify-center;
    }
  }
}

.nc-treeview {
  @apply pt-0.5;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    @apply bg-white;
  }
  &::-webkit-scrollbar-thumb {
    @apply bg-scrollbar;
  }
  &::-webkit-scrollbar-thumb:hover {
    @apply bg-scrollbar-hover;
  }
}
</style>
