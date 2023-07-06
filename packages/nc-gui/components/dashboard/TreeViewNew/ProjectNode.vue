<script lang="ts" setup>
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

const toggleDialog = inject(ToggleDialogInj, () => {})

const { addNewPage, populatedNestedPages } = useDocStore()

const { getDashboardProjectUrl: dashboardProjectUrl, populateLayouts } = useDashboardStore()

const activeProjectId = computed(() => route.params.projectId as string | undefined)

const { projectUrl: docsProjectUrl } = useDocStore()

const { $e } = useNuxtApp()

const isOptionsOpen = ref(false)

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

function openSchemaMagicDialog(baseId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSchemaMagic'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: string, baseId?: string) {
  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openAirtableImportDialog(baseId?: string) {
  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateMagicDialog(baseId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableMagic'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

onKeyStroke('Escape', () => {
  if (isOptionsOpen.value) {
    isOptionsOpen.value = false
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
              class="min-w-6 mr-1.5 opacity-0 group-hover:opacity-100 hover:text-black text-gray-600"
              :class="{ '!text-black !opacity-100': isOptionsOpen }"
              data-testid="nc-sidebar-context-menu"
              @click.stop
            />
            <template #overlay>
              <a-menu
                class="nc-sidebar-md"
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
                        <div class="text-base font-semibold capitalize text-gray-600">
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

                <template v-if="project?.bases?.[0]?.enabled && !project?.bases?.slice(1).filter((el) => el.enabled)?.length">
                  <a-menu-item-group class="!px-0 !mx-0">
                    <template #title>
                      <div class="flex items-center">
                        Noco
                        <GeneralIcon icon="magic" class="ml-1 text-orange-400" />
                      </div>
                    </template>
                    <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(project.bases[0].id)">
                      <div class="color-transition nc-project-menu-item group">
                        <GeneralIcon icon="magic1" class="group-hover:text-accent" />
                        Create table
                      </div>
                    </a-menu-item>
                    <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(project.bases[0].id)">
                      <div class="color-transition nc-project-menu-item group">
                        <GeneralIcon icon="magic1" class="group-hover:text-accent" />
                        Create schema
                      </div>
                    </a-menu-item>
                  </a-menu-item-group>

                  <a-menu-divider class="my-0" />

                  <!-- Quick Import From -->
                  <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
                    <a-menu-item
                      v-if="isUIAllowed('airtableImport', false, projectRole)"
                      key="quick-import-airtable"
                      @click="openAirtableImportDialog(project.bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <GeneralIcon icon="airtable" class="group-hover:text-accent" />
                        Airtable
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('csvImport', false, projectRole)"
                      key="quick-import-csv"
                      @click="openQuickImportDialog('csv', project.bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <GeneralIcon icon="csv" class="group-hover:text-accent" />
                        CSV file
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('jsonImport', false, projectRole)"
                      key="quick-import-json"
                      @click="openQuickImportDialog('json', project.bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <GeneralIcon icon="json" class="group-hover:text-accent" />
                        JSON file
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('excelImport', false, projectRole)"
                      key="quick-import-excel"
                      @click="openQuickImportDialog('excel', project.bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <GeneralIcon icon="excel" class="group-hover:text-accent" />
                        Microsoft Excel
                      </div>
                    </a-menu-item>
                  </a-menu-item-group>

                  <a-menu-divider class="my-0" />

                  <a-menu-item-group title="Connect to new datasource" class="!px-0 !mx-0">
                    <a-menu-item
                      key="connect-new-source"
                      @click="toggleDialog(true, 'dataSources', ClientType.MYSQL, project.id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <LogosMysqlIcon class="group-hover:text-accent" />
                        MySQL
                      </div>
                    </a-menu-item>
                    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG, project.id)">
                      <div class="color-transition nc-project-menu-item group">
                        <LogosPostgresql class="group-hover:text-accent" />
                        Postgres
                      </div>
                    </a-menu-item>
                    <a-menu-item
                      key="connect-new-source"
                      @click="toggleDialog(true, 'dataSources', ClientType.SQLITE, project.id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <VscodeIconsFileTypeSqlite class="group-hover:text-accent" />
                        SQLite
                      </div>
                    </a-menu-item>
                    <a-menu-item
                      key="connect-new-source"
                      @click="toggleDialog(true, 'dataSources', ClientType.MSSQL, project.id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <SimpleIconsMicrosoftsqlserver class="group-hover:text-accent" />
                        MSSQL
                      </div>
                    </a-menu-item>
                    <a-menu-item
                      v-if="appInfo.ee"
                      key="connect-new-source"
                      @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE, project.id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <LogosSnowflakeIcon class="group-hover:text-accent" />
                        Snowflake
                      </div>
                    </a-menu-item>
                  </a-menu-item-group>

                  <a-menu-divider class="my-0" />

                  <a-menu-item v-if="isUIAllowed('importRequest', false, projectRole)" key="add-new-table" class="py-1 rounded-b">
                    <a
                      v-e="['e:datasource:import-request']"
                      href="https://github.com/nocodb/nocodb/issues/2052"
                      target="_blank"
                      class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-project-menu-item group after:(!rounded-b)"
                    >
                      <GeneralIcon icon="openInNew" class="group-hover:text-accent" />
                      <!-- Request a data source you need? -->
                      {{ $t('labels.requestDataSource') }}
                    </a>
                  </a-menu-item>
                </template>
              </a-menu>
            </template>
          </a-dropdown>

          <div
            class="mr-1 flex flex-row pr-1 items-center gap-x-2 cursor-pointer hover:text-black text-gray-600 text-sm invisible !group-hover:visible"
            data-testid="nc-sidebar-add-project-entity"
            :class="{ '!text-black !visible': isAddNewProjectChildEntityLoading, '!visible': isOptionsOpen }"
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
