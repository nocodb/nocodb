<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import type { BaseType, ProjectType, TableType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import AddNewTableNode from './AddNewTableNode'
import TableList from './TableList'
import { openLink, useProjects } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import { ProjectInj, ProjectRoleInj, ToggleDialogInj } from '~/context'
import type { NcProject } from '~~/lib'
import MdiInformationSlabSymbol from '~icons/ion/information'
import { isElementInvisible } from '~~/utils/domUtils'

const indicator = h(LoadingOutlined, {
  class: '!text-gray-400',
  style: {
    fontSize: '0.85rem',
  },
  spin: true,
})

const router = useRouter()
const route = $(router.currentRoute)

const { setMenuContext, openRenameTableDialog, duplicateTable } = inject(TreeViewFunctions)!

const project = inject(ProjectInj)!

const projectsStore = useProjects()

const {
  loadProject,
  createProject: _createProject,
  isProjectEmpty,
  updateProject,
  deleteProject,
  getProjectMetaInfo,
} = projectsStore
const { projects } = storeToRefs(projectsStore)

const { loadProjectTables } = useTablesStore()
const { activeTable } = storeToRefs(useTablesStore())

const { addNewLayout } = useDashboardStore()

const { appInfo } = useGlobal()

const { closeTab, addSqlEditorTab } = useTabs()

const editMode = ref(false)

const tempTitle = ref('')

const { t } = useI18n()

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useUIPermission()

const projectRole = inject(ProjectRoleInj)

const { projectUrl } = useProject()

const toggleDialog = inject(ToggleDialogInj, () => {})

const { addNewPage, populatedNestedPages } = useDocStore()

const { getDashboardProjectUrl: dashboardProjectUrl, populateLayouts } = useDashboardStore()

const activeProjectId = computed(() => route.params.projectId as string | undefined)

const { projectUrl: docsProjectUrl } = useDocStore()

const { $e } = useNuxtApp()

const isOptionsOpen = ref(false)
const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const contextMenuTarget = reactive<{ type?: 'project' | 'base' | 'table' | 'main' | 'layout'; value?: any }>({})
const activeKey = ref<string[]>([])
const [searchActive] = useToggle()
const filterQuery = $ref('')
const { deleteTable } = useTable()
const keys = $ref<Record<string, number>>({})

// If only project is open, i.e in case of docs, project view is open and not the page view
const projectViewOpen = computed(() => {
  const routeNameSplit = String(route?.name).split('projectId-index-index')
  if (routeNameSplit.length <= 1) return false

  const routeNameAfterProjectView = routeNameSplit[routeNameSplit.length - 1]
  return routeNameAfterProjectView.split('-').length === 2 || routeNameAfterProjectView.split('-').length === 1
})

const enableEditMode = () => {
  editMode.value = true
  tempTitle.value = project.value.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
    input.value?.scrollIntoView()
  })
}

const updateProjectTitle = async () => {
  try {
    await updateProject(project.value.id!, {
      title: tempTitle.value,
    })
    editMode.value = false
    tempTitle.value = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const closeEditMode = () => {
  editMode.value = false
  tempTitle.value = ''
}

const confirmDeleteProject = () => {
  Modal.confirm({
    title: 'Delete Project',
    content: 'Are you sure you want to delete this project?',
    onOk: async () => {
      try {
        await deleteProject(project.value.id!)
        await closeTab(project.value.id as any)
        message.success('Project deleted successfully')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const { copy } = useCopy(true)

const copyProjectInfo = async () => {
  try {
    if (
      await copy(
        Object.entries(await getProjectMetaInfo(project.value.id!)!)
          .map(([k, v]) => `${k}: **${v}**`)
          .join('\n'),
      )
    ) {
      // Copied to clipboard
      message.info(t('msg.info.copiedToClipboard'))
    }
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

defineExpose({
  enableEditMode,
})

const setIcon = async (icon: string, project: ProjectType) => {
  try {
    const meta = {
      ...((project.meta as object) || {}),
      icon,
    }

    projectsStore.updateProject(project.id!, { meta: JSON.stringify(meta) })

    $e('a:project:icon:navdraw', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function openTableCreateDialog(baseIndex?: number | undefined) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  let baseId = project.value!.bases?.[0].id
  if (typeof baseIndex === 'number') {
    baseId = project.value!.bases?.[baseIndex].id
  }

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    baseId, // || bases.value[0].id,
    'projectId': project.value!.id,
    'onCreate': closeDialog,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

    if (!activeKey.value || !activeKey.value.includes(`collapse-${baseId}`)) {
      activeKey.value.push(`collapse-${baseId}`)
    }

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      // Verify that table node is not in the viewport
      if (isElementInvisible(newTableDom)) {
        // Scroll to the table node
        newTableDom?.scrollIntoView({ behavior: 'smooth' })
      }
    }, 1000)

    close(1000)
  }
}

const isAddNewProjectChildEntityLoading = ref(false)
const addNewProjectChildEntity = async () => {
  if (isAddNewProjectChildEntityLoading.value) return

  isAddNewProjectChildEntityLoading.value = true
  try {
    switch (project.value.type) {
      case NcProjectType.DASHBOARD:
        await populateLayouts({ projectId: project.value.id! })
        await addNewLayout({ projectId: project.value!.id! })
        break
      case NcProjectType.DOCS:
        await populatedNestedPages({ projectId: project.value.id! })
        await addNewPage({ parentPageId: undefined, projectId: project.value!.id! })
        break
      case NcProjectType.DB:
        openTableCreateDialog()
        break
    }

    if (!project.value.isExpanded) {
      project.value.isExpanded = true
    }
  } finally {
    isAddNewProjectChildEntityLoading.value = false
  }
}

// todo: temp
const isSharedBase = ref(false)

const onProjectClick = async (project: NcProject, ignoreNavigation?: boolean) => {
  if (!project) {
    return
  }

  project.isExpanded = !project.isExpanded

  const isProjectPopulated = projectsStore.isProjectPopulated(project.id!)

  if (!isProjectPopulated) project.isLoading = true

  // if dashboard or document project, add a document tab and route to the respective page
  switch (project.type) {
    case 'dashboard':
      $e('c:dashboard:open', project.id)
      await populateLayouts({ projectId: project.id! })
      if (!ignoreNavigation) {
        await navigateTo(dashboardProjectUrl(project.id!))
      }
      break
    case 'documentation':
      // addTab({
      //   id: project.id,
      //   title: project.title!,
      //   type: TabType.DOCUMENT,
      //   projectId: project.id,
      // })
      $e('c:document:open', project.id)
      await populatedNestedPages({ projectId: project.id! })
      if (!ignoreNavigation) {
        await navigateTo(docsProjectUrl(project.id!))
      }
      break
    case 'database':
      if (!ignoreNavigation) {
        await navigateTo(
          projectUrl({
            id: project.id!,
            type: 'database',
          }),
        )
      }

      if (!isProjectPopulated) {
        await loadProject(project.id!)
        await loadProjectTables(project.id!)
      }
      break
    default:
      throw new Error(`Unknown project type: ${project.type}`)
  }

  if (!isProjectPopulated) {
    const updatedProject = projects.value.get(project.id!)!
    updatedProject.isLoading = false
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

const reloadTables = async () => {
  $e('a:table:refresh:navdraw')

  // await loadTables()
}

watch(
  () => activeTable.value?.id,
  async () => {
    if (!activeTable.value) return

    const baseId = activeTable.value.base_id
    if (!baseId) return

    if (!activeKey.value.includes(`collapse-${baseId}`)) {
      activeKey.value.push(`collapse-${baseId}`)
    }
  },
  {
    immediate: true,
  },
)

onKeyStroke('Escape', () => {
  if (isOptionsOpen.value) {
    isOptionsOpen.value = false
  }

  for (const key of Object.keys(isBasesOptionsOpen.value)) {
    isBasesOptionsOpen.value[key] = false
  }
})
</script>

<template>
  <a-dropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
    <div
      class="mx-1 nc-project-sub-menu rounded-md"
      :class="{ active: project.isExpanded }"
      :data-testid="`nc-sidebar-project-${project.title}`"
      :data-project-id="project.id"
    >
      <div class="flex items-center gap-0.75 py-0.25 cursor-pointer" @contextmenu="setMenuContext('project', project)">
        <div
          ref="projectNodeRefs"
          :class="{
            'bg-primary-selected': activeProjectId === project.id && projectViewOpen,
            'hover:bg-hover': !(activeProjectId === project.id && projectViewOpen),
          }"
          :data-testid="`nc-sidebar-project-title-${project.title}`"
          class="project-title-node h-7.25 flex-grow rounded-md group flex items-center w-full"
        >
          <div @click="onProjectClick(project, true)">
            <div class="nc-sidebar-expand pl-2 pr-1">
              <PhTriangleFill
                class="invisible group-hover:visible cursor-pointer transform transition-transform duration-500 h-1.25 w-1.75 text-gray-500 rotate-90"
                :class="{ '!rotate-180': project.isExpanded, '!visible': isOptionsOpen }"
              />
            </div>
          </div>
          <component
            :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Dropdown : 'div'"
            trigger="click"
            destroy-popup-on-hide
            class="flex items-center mr-1"
            @click.stop
          >
            <div class="flex items-center select-none w-6 h-full" @click.stop>
              <a-spin
                v-if="project.isLoading"
                class="nc-sidebar-icon !flex !flex-row !items-center !my-0.5 !mx-1.5 w-8"
                :indicator="indicator"
              />

              <GeneralEmojiPicker
                :key="project.meta?.icon"
                :emoji="project.meta?.icon"
                size="small"
                readonly
                @emoji-selected="setIcon($event, project)"
              >
                <template #default>
                  <GeneralProjectIcon :type="project.type" />
                </template>
              </GeneralEmojiPicker>
            </div>
            <template v-if="isUIAllowed('projectIconCustomisation', false, projectRole)" #overlay>
              <GeneralEmojiPicker
                :key="project.meta?.icon"
                :emoji="project.meta?.icon"
                clearable
                @emoji-selected="setIcon($event, project)"
              />
            </template>
          </component>

          <input
            v-if="editMode"
            ref="input"
            v-model="tempTitle"
            class="flex-grow leading-1 outline-0 ring-none"
            @click.stop
            @keyup.enter="updateProjectTitle"
            @keyup.esc="closeEditMode"
          />
          <span
            v-else
            class="capitalize text-ellipsis overflow-hidden select-none"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            :class="{ 'text-black font-semibold': activeProjectId === project.id && projectViewOpen }"
            @click="onProjectClick(project)"
          >
            {{ project.title }}
          </span>
          <div :class="{ 'flex flex-grow h-full': !editMode }" @click="onProjectClick(project)"></div>

          <a-dropdown v-model:visible="isOptionsOpen" trigger="click">
            <MdiDotsHorizontal
              class="min-w-5 min-h-5 py-0.25 mr-1.5 !ring-0 focus:!ring-0 !focus:border-0 !focus:outline-0 opacity-0 group-hover:(opacity-100) hover:text-black text-gray-600 rounded"
              :class="{ '!text-black !opacity-100': isOptionsOpen }"
              data-testid="nc-sidebar-context-menu"
              @click.stop
            />
            <template #overlay>
              <a-menu
                class="nc-scrollbar-md"
                :style="{
                  maxHeight: '70vh',
                  overflow: 'overlay',
                }"
                @click="isOptionsOpen = false"
              >
                <!--          <a-menu class="!ml-1 !w-[300px] !text-sm"> -->
                <a-menu-item-group>
                  <template #title>
                    <div class="group select-none flex items-center gap-4 py-1">
                      <GeneralIcon icon="folder" class="group-hover:text-accent text-xl" />

                      <div class="flex flex-col">
                        <div class="text-base font-semibold capitalize text-gray-600 group-hover:text-accent">
                          <GeneralTruncateText>{{ project.title }}</GeneralTruncateText>
                        </div>

                        <!-- <div v-if="!isSharedBase" class="flex items-center gap-1">
                          <div class="group-hover:(!text-primary)">ID:</div>

                          <div class="text-xs group-hover:text-accent truncate font-italic">{{ project.id }}</div>
                        </div> -->
                      </div>
                    </div>
                  </template>
                  <template v-if="!isSharedBase">
                    <a-menu-item @click="enableEditMode">
                      <div class="nc-project-menu-item group">
                        <GeneralIcon icon="edit" class="group-hover:text-accent" />
                        Edit
                      </div>
                    </a-menu-item>

                    <!-- Copy Project Info -->
                    <a-menu-item v-if="false" key="copy">
                      <div
                        v-e="['c:navbar:user:copy-proj-info']"
                        class="nc-project-menu-item group"
                        @click.stop="copyProjectInfo"
                      >
                        <GeneralIcon icon="copy" class="group-hover:text-accent" />
                        {{ $t('activity.account.projInfo') }}
                      </div>
                    </a-menu-item>

                    <a-menu-divider v-if="false" />

                    <!-- Swagger: Rest APIs -->
                    <a-menu-item key="api">
                      <div
                        v-if="isUIAllowed('apiDocs')"
                        v-e="['e:api-docs']"
                        class="nc-project-menu-item group"
                        @click.stop="openLink(`/api/v1/db/meta/projects/${project.id}/swagger`, appInfo.ncSiteUrl)"
                      >
                        <GeneralIcon icon="json" class="group-hover:text-accent" />
                        {{ $t('activity.account.swagger') }}
                      </div>
                    </a-menu-item>
                  </template>
                </a-menu-item-group>
                <!--          </a-menu> -->

                <DashboardTreeViewNewBaseOptions v-model:project="project" :base="project.bases[0]" />

                <a-menu-divider />

                <!-- Team & Settings -->
                <a-menu-item key="teamAndSettings">
                  <div
                    v-if="isUIAllowed('settings')"
                    v-e="['c:navdraw:project-settings']"
                    class="nc-project-menu-item group"
                    @click="toggleDialog(true, 'teamAndAuth', undefined, project.id)"
                  >
                    <GeneralIcon icon="settings" class="group-hover:text-accent" />
                    {{ $t('activity.settings') }}
                  </div>
                </a-menu-item>

                <a-menu-divider v-if="false" />

                <a-menu-item @click="confirmDeleteProject">
                  <div class="nc-project-menu-item group text-red-500">
                    <GeneralIcon icon="delete2" class="group-hover:text-accent" />
                    Delete
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <div
            v-if="isUIAllowed('tableCreate', false, projectRole)"
            class="mr-2 flex flex-row items-center gap-x-2 cursor-pointer hover:(text-black) text-gray-600 text-sm invisible !group-hover:visible rounded"
            data-testid="nc-sidebar-add-project-entity"
            :class="{ '!text-black !visible': isAddNewProjectChildEntityLoading, '!visible': isOptionsOpen }"
            @click.stop="addNewProjectChildEntity"
          >
            <div v-if="isAddNewProjectChildEntityLoading" class="flex flex-row items-center">
              <a-spin class="!flex !flex-row !items-center !my-0.5" :indicator="indicator" />
            </div>
            <MdiPlus v-else class="min-w-5 min-h-5 py-0.25" />
          </div>
        </div>
      </div>

      <div
        v-if="project.id && !project.isLoading"
        key="g1"
        class="overflow-x-hidden transition-max-height"
        :class="{ 'max-h-0': !project.isExpanded }"
      >
        <div v-if="project.type === 'documentation'">
          <DocsSideBar v-if="project.isExpanded" :project="project" />
        </div>
        <div v-else-if="project.type === 'dashboard'">
          <LayoutsSideBar v-if="project.isExpanded" :project="project" />
        </div>
        <template v-if="project && project?.bases">
          <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
            <div v-if="project?.bases?.[0]?.enabled" class="flex-1">
              <div class="transition-height duration-200">
                <TableList :project="project" :base-index="0" />
              </div>
            </div>

            <div v-if="project?.bases?.slice(1).filter((el) => el.enabled)?.length" class="transition-height duration-200">
              <div class="border-none sortable-list">
                <div v-for="(base, baseIndex) of project.bases" :key="`base-${base.id}`">
                  <template v-if="baseIndex === 0"></template>
                  <a-collapse
                    v-else-if="base && base.enabled"
                    v-model:activeKey="activeKey"
                    class="!mx-0 !px-0 nc-sidebar-base-node"
                    :class="[{ hidden: searchActive && !!filterQuery }]"
                    expand-icon-position="left"
                    :bordered="false"
                    ghost
                  >
                    <template #expandIcon="{ isActive }">
                      <div class="flex flex-row items-center -mt-2">
                        <PhTriangleFill
                          class="nc-sidebar-base-node-btns -mt-1 invisible cursor-pointer transform transition-transform duration-500 h-1.25 w-1.75 text-gray-500 rotate-90"
                          :class="{ '!rotate-180': isActive }"
                        />
                      </div>
                    </template>
                    <a-collapse-panel :key="`collapse-${base.id}`">
                      <template #header>
                        <div class="w-full flex flex-row justify-between">
                          <div
                            v-if="baseIndex === 0"
                            class="base-context flex items-center gap-2 text-gray-800"
                            @contextmenu="setMenuContext('base', base)"
                          >
                            <GeneralBaseLogo :base-type="base.type" />
                            Default
                          </div>
                          <div
                            v-else
                            class="base-context flex items-center gap-1.75 text-gray-800"
                            @contextmenu="setMenuContext('base', base)"
                          >
                            <GeneralBaseLogo :base-type="base.type" class="w-4" />
                            <div class="flex capitalize">
                              {{ base.alias || '' }}
                            </div>
                            <a-tooltip>
                              <template #title>External DB</template>
                              <div>
                                <GeneralIcon icon="info" class="text-gray-400 -mt-0.5 hover:text-gray-700" />
                              </div>
                            </a-tooltip>
                          </div>
                          <div class="flex flex-row items-center gap-x-1">
                            <a-dropdown
                              :visible="isBasesOptionsOpen[base!.id!]"
                              trigger="click"
                              @update:visible="isBasesOptionsOpen[base!.id!] = $event"
                            >
                              <MdiDotsHorizontal
                                class="invisible nc-sidebar-base-node-btns !ring-0 focus:!ring-0 !focus:border-0 !focus:outline-0 hover:text-black py-0.25 h-5.5 w-5.5 px-0.5 mt-0.25 rounded text-gray-600"
                                :class="{ '!text-black !opacity-100': isBasesOptionsOpen[base!.id!] }"
                                @click.stop="isBasesOptionsOpen[base!.id!] = !isBasesOptionsOpen[base!.id!]"
                              />
                              <template #overlay>
                                <a-menu
                                  class="nc-scrollbar-md"
                                  :style="{
                                    maxHeight: '70vh',
                                    overflow: 'overlay',
                                  }"
                                  @click="isBasesOptionsOpen[base!.id!] = false"
                                >
                                  <DashboardTreeViewNewBaseOptions v-model:project="project" :base="base" />
                                </a-menu>
                              </template>
                            </a-dropdown>

                            <div
                              v-if="isUIAllowed('tableCreate', false, projectRole)"
                              class="flex invisible nc-sidebar-base-node-btns !focus:outline-0 text-gray-600 hover:text-gray-700 rounded px-0.35 mt-0.25"
                              @click.stop="openTableCreateDialog(baseIndex)"
                            >
                              <component :is="iconMap.plus" class="text-inherit h-5.5 w-5.5 py-0.5 !focus:outline-0" />
                            </div>
                          </div>
                        </div>
                      </template>
                      <!-- <AddNewTableNode
                        :project="project"
                        :base-index="baseIndex"
                        @open-table-create-dialog="openTableCreateDialog()"
                      /> -->
                      <div
                        ref="menuRefs"
                        :key="`sortable-${base.id}-${base.id && base.id in keys ? keys[base.id] : '0'}`"
                        :nc-base="base.id"
                      >
                        <TableList :project="project" :base-index="baseIndex" />
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
</template>

<style lang="scss" scoped>
.nc-sidebar-icon {
  @apply ml-0.5 mr-1;
}

:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-7 !pr-1 !py-0.75 hover:bg-gray-100 !rounded-md;
}

:deep(.ant-collapse-header:hover .nc-sidebar-base-node-btns) {
  @apply visible;
}
</style>
