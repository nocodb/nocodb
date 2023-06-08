<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'
import { nextTick } from '@vue/runtime-core'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import type { BaseType, ProjectType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import AddNewTableNode from './AddNewTableNode'
import TableList from './TableList'
import { openLink, useProjects } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import { ProjectInj, ProjectRoleInj, ToggleDialogInj } from '~/context'
import type { NcProject } from '~~/lib'

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
const { projectTables } = storeToRefs(useTablesStore())

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

const toggleDialog = inject(ToggleDialogInj)

const { addNewPage, populatedNestedPages } = useDocStore()

const { getDashboardProjectUrl: dashboardProjectUrl, populateLayouts } = useDashboardStore()

const activeProjectId = computed(() => route.params.projectId as string | undefined)

const { projectUrl: docsProjectUrl } = useDocStore()

const { $e } = useNuxtApp()

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

function openTableCreateDialog() {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  const baseId = project.value!.bases?.[0].id

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
    'projectId': project.value!.id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

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

const onProjectClick = async (project: NcProject) => {
  if (!project) {
    return
  }

  project.isExpanded = !project.isExpanded

  const isProjectPopulated = projectsStore.isProjectPopulated(project.id!)

  if (!isProjectPopulated) project.isLoading = true

  // if dashboard or document project, add a document tab and route to the respective page
  switch (project.type) {
    case 'dashboard':
      // addTab({
      //   id: project.id,
      //   title: project.title!,
      //   type: TabType.LAYOUT,
      //   projectId: project.id,
      // })
      $e('c:dashboard:open', project.id)
      await populateLayouts({ projectId: project.id! })
      await navigateTo(dashboardProjectUrl(project.id!))
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
      await navigateTo(docsProjectUrl(project.id!))
      break
    case 'database':
      await navigateTo(
        projectUrl({
          id: project.id!,
          type: 'database',
        }),
      )

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
</script>

<template>
  <a-dropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
    <div class="mx-1 nc-project-sub-menu rounded-md" :class="{ active: project.isExpanded }">
      <div
        class="flex items-center gap-0.75 py-0.25 cursor-pointer"
        @click="onProjectClick(project)"
        @contextmenu="setMenuContext('project', project)"
      >
        <div
          ref="projectNodeRefs"
          :class="{
            'bg-primary-selected': activeProjectId === project.id && projectViewOpen,
            'hover:bg-hover': !(activeProjectId === project.id && projectViewOpen),
          }"
          class="project-title-node h-7.25 flex-grow rounded-md group flex items-center w-full pl-2"
        >
          <div class="nc-sidebar-expand">
            <PhTriangleFill
              class="invisible group-hover:visible cursor-pointer transform transition-transform duration-500 h-1.25 w-1.75 text-gray-500 rotate-90"
              :class="{ '!rotate-180': project.isExpanded }"
            />
          </div>
          <component
            :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Dropdown : 'div'"
            trigger="click"
            destroy-popup-on-hide
            class="flex items-center mx-1"
            @click.stop
          >
            <div class="flex items-center select-none w-6 h-full" @click.stop>
              <a-spin
                v-if="project.isLoading"
                class="nc-sidebar-icon !flex !flex-row !items-center !my-0.5 !ml-1.5 !mr-1.5 w-8"
                :indicator="indicator"
              />
              <component :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Tooltip : 'div'" v-else>
                <span
                  v-if="project.meta?.icon"
                  :key="project.meta?.icon"
                  class="flex items-center hover:bg-gray-200 p-1 rounded-md h-6 w-6"
                >
                  <IconifyIcon
                    :key="project.meta?.icon"
                    :data-testid="`nc-icon-${project.meta?.icon}`"
                    class="text-lg"
                    :icon="project.meta?.icon"
                  ></IconifyIcon>
                </span>

                <GeneralProjectIcon v-else :type="project.type" />

                <template v-if="isUIAllowed('projectIconCustomisation', false, projectRole)" #title>
                  <span class="text-xs"> Change icon </span>
                </template>
              </component>
            </div>
            <template v-if="isUIAllowed('projectIconCustomisation', false, projectRole)" #overlay>
              <GeneralEmojiIcons
                class="shadow bg-white p-2"
                :show-reset="project.meta?.icon"
                @select-icon="setIcon($event, project)"
              />
            </template>
          </component>

          <input
            v-if="editMode"
            ref="input"
            v-model="tempTitle"
            class="flex-grow min-w-5 leading-1 outline-0 ring-none"
            @click.stop
            @keyup.enter="updateProjectTitle"
            @keyup.esc="closeEditMode"
          />
          <span v-else class="capitalize min-w-5 text-ellipsis overflow-clip select-none">
            {{ project.title }}
          </span>
          <span :class="{ 'flex-grow': !editMode }"></span>

          <a-dropdown>
            <MdiDotsHorizontal class="mr-1.5 opacity-0 group-hover:opacity-100 hover:text-black text-gray-600" @click.stop />
            <template #overlay>
              <a-menu>
                <!--          <a-menu class="!ml-1 !w-[300px] !text-sm"> -->
                <a-menu-item-group>
                  <template #title>
                    <div class="group select-none flex items-center gap-4 py-1">
                      <GeneralIcon icon="folder" class="group-hover:text-accent text-xl" />

                      <div class="flex flex-col">
                        <div class="text-lg group-hover:(!text-primary) font-semibold capitalize">
                          <GeneralTruncateText>{{ project.title }}</GeneralTruncateText>
                        </div>

                        <div v-if="!isSharedBase" class="flex items-center gap-1">
                          <div class="group-hover:(!text-primary)">ID:</div>

                          <div class="text-xs group-hover:text-accent truncate font-italic">{{ project.id }}</div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <template v-if="!isSharedBase">
                    <!-- Copy Project Info -->
                    <a-menu-item key="copy">
                      <div
                        v-e="['c:navbar:user:copy-proj-info']"
                        class="nc-project-menu-item group"
                        @click.stop="copyProjectInfo"
                      >
                        <GeneralIcon icon="copy" class="group-hover:text-accent" />
                        {{ $t('activity.account.projInfo') }}
                      </div>
                    </a-menu-item>

                    <a-menu-divider />

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
                        {{ $t('title.teamAndSettings') }}
                      </div>
                    </a-menu-item>

                    <a-menu-divider />

                    <a-menu-item @click="enableEditMode">
                      <div class="nc-project-menu-item group">
                        <GeneralIcon icon="edit" />
                        Edit
                      </div>
                    </a-menu-item>
                    <a-menu-item @click="confirmDeleteProject">
                      <div class="nc-project-menu-item group">
                        <GeneralIcon icon="delete" />
                        Delete
                      </div>
                    </a-menu-item>
                  </template>
                </a-menu-item-group>
                <!--          </a-menu> -->
              </a-menu>
            </template>
          </a-dropdown>

          <div
            class="mr-1 flex flex-row pr-1 items-center gap-x-2 cursor-pointer hover:text-black text-gray-600 text-sm invisible !group-hover:visible"
            data-testid="nc-docs-sidebar-add-page"
            :class="{ '!text-black !visible': isAddNewProjectChildEntityLoading }"
            @click.stop="addNewProjectChildEntity"
          >
            <div v-if="isAddNewProjectChildEntityLoading" class="flex flex-row items-center">
              <a-spin class="!flex !flex-row !items-center !my-0.5" :indicator="indicator" />
            </div>
            <MdiPlus v-else />
          </div>
        </div>
      </div>

      <div
        v-if="project.id && !project.isLoading"
        key="g1"
        class="overflow-y-auto overflow-x-hidden transition-max-height"
        :class="{ 'max-h-0': !project.isExpanded, 'max-h-500': project.isExpanded }"
      >
        <div v-if="isProjectEmpty(project.id)" class="flex ml-11.75 my-1 text-gray-500 select-none">Empty</div>
        <div v-else-if="project.type === 'documentation'">
          <DocsSideBar v-if="project.isExpanded" :project="project" />
        </div>
        <div v-else-if="project.type === 'dashboard'">
          <LayoutsSideBar v-if="project.isExpanded" :project="project" />
        </div>
        <template v-else-if="project && project?.bases">
          <div class="flex-1 overflow-y-auto flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
            <div
              v-if="project?.bases?.[0]?.enabled && !project?.bases?.slice(1).filter((el) => el.enabled)?.length"
              class="flex-1"
            >
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
                          ({{ projectTables.get(project.id)?.filter((table) => table.base_id === base.id).length || '0' }})
                        </div>
                      </template>
                      <AddNewTableNode
                        :project="project"
                        :base-index="baseIndex"
                        @open-table-create-dialog="openTableCreateDialog()"
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
</template>

<style lang="scss" scoped>
.nc-sidebar-icon {
  @apply ml-0.5 mr-1;
}
</style>
