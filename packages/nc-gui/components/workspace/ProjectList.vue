<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { ProjectStatus, WorkspaceUserRoles } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { nextTick } from '@vue/runtime-core'
import { NcProjectType, navigateTo, projectThemeColors, storeToRefs, timeAgo, useWorkspace } from '#imports'
import { useNuxtApp } from '#app'
import { useGlobal } from '~/composables/useGlobal'

const workspaceStore = useWorkspace()
const projectsStore = useProjects()
const { addToFavourite, removeFromFavourite, updateProjectTitle, populateWorkspace } = workspaceStore
const { activePage } = storeToRefs(workspaceStore)

const { loadProjects } = useProjects()
const { projects, projectsList, isProjectsLoading } = storeToRefs(useProjects())

const { navigateToProject } = $(useGlobal())

// const filteredProjects = computed(() => projects.value?.filter((p) => !p.deleted) || [])

const { $e, $api, $jobs } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const openProject = async (project: ProjectType) => {
  navigateToProject({
    projectId: project.id!,
    workspaceId: project.fk_workspace_id!,
    type: project.type as NcProjectType,
  })
}

const roleAlias = {
  [WorkspaceUserRoles.OWNER]: 'Workspace Owner',
  [WorkspaceUserRoles.VIEWER]: 'Workspace Viewer',
  [WorkspaceUserRoles.CREATOR]: 'Workspace Creator',
  [ProjectRole.Creator]: 'Project Creator',
  [ProjectRole.Editor]: 'Project Editor',
  [ProjectRole.Viewer]: 'Project Viewer',
  [ProjectRole.Commenter]: 'Project Commenter',
  [ProjectRole.Owner]: 'Project Owner',
}

const deleteProject = (project: ProjectType) => {
  $e('c:project:delete')

  Modal.confirm({
    title: `Do you want to delete '${project.title}' project?`,
    wrapClassName: 'nc-modal-project-delete',
    okText: 'Yes',
    okType: 'danger',
    cancelText: 'No',
    async onOk() {
      try {
        await $api.project.delete(project.id as string)

        $e('a:project:delete')

        projects.value.delete(project!.id!)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const handleProjectColor = async (projectId: string, color: string) => {
  const tcolor = tinycolor(color)

  if (tcolor.isValid()) {
    const complement = tcolor.complement()

    const project: ProjectType = await $api.project.read(projectId)

    const meta = project?.meta && typeof project.meta === 'string' ? JSON.parse(project.meta) : project.meta || {}

    await $api.project.update(projectId, {
      color,
      meta: JSON.stringify({
        ...meta,
        theme: {
          primaryColor: color,
          accentColor: complement.toHex8String(),
        },
      }),
    })

    // Update local project
    const localProject = projects.value.get(projectId)

    if (localProject) {
      localProject.color = color

      localProject.meta = JSON.stringify({
        ...meta,
        theme: {
          primaryColor: color,
          accentColor: complement.toHex8String(),
        },
      })
    }
  }
}

const getProjectPrimary = (project: ProjectType) => {
  if (!project) return

  const meta = project.meta && typeof project.meta === 'string' ? JSON.parse(project.meta) : project.meta || {}

  return meta.theme?.primaryColor || themeV2Colors['royal-blue'].DEFAULT
}

const renameInput = ref<HTMLInputElement>()
const enableEdit = (index: number) => {
  projectsList.value![index]!.temp_title = projectsList.value![index].title
  projectsList.value![index]!.edit = true
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}
const disableEdit = (index: number) => {
  projectsList.value![index]!.temp_title = undefined
  projectsList.value![index]!.edit = false
}

const customRow = (record: ProjectType) => ({
  onClick: async () => {
    openProject(record)

    $e('a:project:open')
  },
  class: ['group'],
})

const columns = computed(() => [
  {
    title: 'Project Name',
    dataIndex: 'title',
    sorter: {
      compare: (a, b) => a.title?.localeCompare(b.title),
      multiple: 5,
    },
  },
  ...(activePage.value !== 'workspace'
    ? [
        {
          title: 'Workspace Name',
          dataIndex: 'workspace_title',
          sorter: {
            compare: (a, b) => a.workspace_title?.localeCompare(b.workspace_title),
            multiple: 4,
          },
        },
      ]
    : []),
  {
    title: 'Role',
    dataIndex: 'workspace_role',
    sorter: {
      compare: (a, b) => a - b,
      multiple: 1,
    },
  },
  {
    title: 'Last Opened',
    dataIndex: 'last_accessed',
    sorter: {
      compare: (a, b) => new Date(b.last_accessed) - new Date(a.last_accessed),
      multiple: 2,
    },
  },

  {
    title: '',
    dataIndex: 'id',
    hidden: true,
    width: '24px',
    style: {
      padding: 0,
    },
  },
])

const isMoveDlgOpen = ref(false)
const selectedProjectToMove = ref()

useDialog(resolveComponent('WorkspaceMoveProjectDlg'), {
  'modelValue': isMoveDlgOpen,
  'project': selectedProjectToMove,
  'onUpdate:modelValue': (isOpen: boolean) => (isMoveDlgOpen.value = isOpen),
  'onSuccess': async (workspaceId: string) => {
    isMoveDlgOpen.value = false
    navigateTo({
      query: {
        workspaceId,
        page: 'workspace',
      },
    })
  },
})

const moveProject = (project: ProjectType) => {
  selectedProjectToMove.value = project
  isMoveDlgOpen.value = true
}

const isDuplicateDlgOpen = ref(false)
const selectedProjectToDuplicate = ref()

useDialog(resolveComponent('DlgProjectDuplicate'), {
  'modelValue': isDuplicateDlgOpen,
  'project': selectedProjectToDuplicate,
  'onUpdate:modelValue': (isOpen: boolean) => (isDuplicateDlgOpen.value = isOpen),
  'onOk': async (jobData: { id: string }) => {
    await loadProjects('workspace')

    $jobs.subscribe({ id: jobData.id }, undefined, async (status: string) => {
      if (status === JobStatus.COMPLETED) {
        await loadProjects('workspace')
      } else if (status === JobStatus.FAILED) {
        message.error('Failed to duplicate project')
        await loadProjects('workspace')
      }
    })

    $e('a:project:duplicate')
  },
})

const duplicateProject = (project: ProjectType) => {
  selectedProjectToDuplicate.value = project
  isDuplicateDlgOpen.value = true
}

let clickCount = 0
let timer: any = null
const delay = 250

function onProjectTitleClick(index: number) {
  clickCount++
  if (clickCount === 1) {
    timer = setTimeout(function () {
      openProject(projectsList.value![index])
      clickCount = 0
    }, delay)
  } else {
    clearTimeout(timer)
    enableEdit(index)
    clickCount = 0
  }
}

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
</script>

<template>
  <div>
    <div
      v-if="!projectsList || projectsList?.length === 0 || isProjectsLoading"
      class="w-full flex flex-row justify-center items-center"
      style="height: calc(100vh - 16rem)"
    >
      <div v-if="isProjectsLoading">
        <GeneralLoader size="xlarge" />
      </div>
      <div v-else class="flex flex-col items-center gap-y-5">
        <MaterialSymbolsInboxOutlineRounded
          class="text-2xl text-primary"
          :class="{
            'h-8 w-8': activePage === 'workspace',
            'h-12 w-12': activePage !== 'workspace',
          }"
        />
        <template v-if="activePage === 'workspace'">
          <div class="font-medium text-xl">Welcome to nocoDB</div>
          <div class="font-medium">Create your first Project!</div>
        </template>
        <template v-else-if="activePage === 'recent'">
          <div class="font-medium text-lg">No Recent Projects</div>
        </template>
        <template v-else-if="activePage === 'starred'">
          <div class="font-medium text-lg">No Starred Projects</div>
        </template>
        <template v-else-if="activePage === 'shared'">
          <div class="font-medium text-lg">No Shared Projects</div>
        </template>
      </div>
    </div>
    <a-table
      v-else
      v-model:data-source="projectsList"
      class="h-full"
      :class="{
        'full-height-table': activePage !== 'workspace',
      }"
      :custom-row="customRow"
      :columns="columns"
      :pagination="false"
      :scroll="{ y: 'calc(100% - 54px)' }"
    >
      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
      </template>

      <template #bodyCell="{ column, text, record, index: i }">
        <template v-if="column.dataIndex === 'title'">
          <div class="flex items-center nc-project-title gap-2.5 max-w-full -ml-1.5">
            <div class="flex items-center gap-2 text-center">
              <GeneralEmojiPicker
                :key="record.id"
                :emoji="record.meta?.icon"
                size="small"
                readonly
                @emoji-selected="setIcon($event, record)"
              >
                <GeneralProjectIcon :type="record.type" />
              </GeneralEmojiPicker>
              <!-- todo: replace with switch -->
            </div>

            <div class="min-w-10">
              <input
                v-if="record.edit"
                ref="renameInput"
                v-model="record.temp_title"
                class="!leading-none p-1 bg-transparent max-w-full !w-auto"
                autofocus
                @click.stop
                @blur="disableEdit(i)"
                @keydown.enter="updateProjectTitle(record)"
                @keydown.esc="disableEdit(i)"
              />

              <div
                v-else
                :title="record.title"
                class="whitespace-nowrap overflow-hidden overflow-ellipsis cursor-pointer"
                @click.stop="onProjectTitleClick(i)"
              >
                {{ record.title }}
              </div>
            </div>

            <!--            <div v-if="!record.edit" class="nc-click-transition-1" @click.stop> -->
            <!--              <MdiStar v-if="record.starred" class="text-yellow-400 cursor-pointer" @click="removeFromFavourite(record.id)" /> -->
            <!--              <MdiStarOutline -->
            <!--                v-else -->
            <!--                class="opacity-0 group-hover:opacity-100 transition transition-opacity text-yellow-400 cursor-pointer" -->
            <!--                @click="addToFavourite(record.id)" -->
            <!--              /> -->
            <!--            </div> -->
          </div>
        </template>

        <div v-if="column.dataIndex === 'last_accessed'" class="text-xs text-gray-500">
          {{ text ? timeAgo(text) : 'Newly invited' }}
        </div>

        <div v-if="column.dataIndex === 'workspace_title'" class="text-xs text-gray-500">
          <span v-if="text" class="text-xs text-gray-500 whitespace-nowrap overflow-hidden overflow-ellipsis">
            <nuxt-link
              :to="{
                query: {
                  page: 'workspace',
                  workspaceId: record.fk_workspace_id,
                },
              }"
              class="!text-gray-500 !no-underline !hover:underline !hover:text-gray-500"
              @click.stop
            >
              {{ text }}
            </nuxt-link>
          </span>
        </div>

        <div v-if="column.dataIndex === 'workspace_role'" class="flex flex-row text-xs justify-between text-gray-500">
          <div class="flex">
            {{ roleAlias[record.workspace_role || record.project_role] }}
          </div>
          <div class="flex items-center gap-2"></div>
        </div>

        <template v-if="column.dataIndex === 'id'">
          <a-dropdown
            v-if="isUIAllowed('projectActionMenu', true, [record.workspace_role, record.project_role].join())"
            :trigger="['click']"
          >
            <div @click.stop>
              <template v-if="record.status === ProjectStatus.JOB">
                <component :is="iconMap.reload" class="animate-infinite animate-spin" />
              </template>
              <GeneralIcon v-else icon="threeDotVertical" class="outline-0 nc-workspace-menu nc-click-transition" />
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="enableEdit(i)">
                  <div class="nc-menu-item-wrapper">
                    <GeneralIcon icon="edit" class="text-gray-500 text-primary" />
                    Rename Project
                  </div>
                </a-menu-item>
                <a-menu-item
                  v-if="
                    record.type === NcProjectType.DB &&
                    isUIAllowed('duplicateProject', true, [record.workspace_role, record.project_role].join())
                  "
                  @click="duplicateProject(record)"
                >
                  <div class="nc-menu-item-wrapper">
                    <GeneralIcon icon="duplicate" class="text-gray-500 text-primary" />
                    Duplicate Project
                  </div>
                </a-menu-item>
                <a-menu-item
                  v-if="isUIAllowed('moveProject', true, [record.workspace_role, record.project_role].join())"
                  @click="moveProject(record)"
                >
                  <div class="nc-menu-item-wrapper">
                    <GeneralIcon icon="move" class="text-gray-500 text-primary" />
                    Move Project
                  </div>
                </a-menu-item>
                <a-menu-item
                  v-if="isUIAllowed('projectDelete', true, [record.workspace_role, record.project_role].join())"
                  @click="deleteProject(record)"
                >
                  <div class="nc-menu-item-wrapper text-red-600">
                    <GeneralIcon icon="delete2" class="text-gray-500 text-error" />
                    Delete Project
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <div v-else></div>
        </template>
      </template>
    </a-table>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-table-cell:first-child) {
  @apply !pl-6;
}

:deep(.ant-table-cell:lst-child) {
  @apply !plr6;
}

:deep(th.ant-table-cell) {
  @apply font-weight-400;
}

:deep(.ant-table-wrapper) {
  .ant-spin-nested-loading,
  .ant-spin-container,
  .ant-table,
  .ant-table-container {
    @apply h-full;
  }
}

:deep(.ant-table-row) {
  @apply cursor-pointer;
}

:deep(th.ant-table-cell) {
  @apply !text-gray-500;
}

:deep(.ant-table-cell:last-child) {
  @apply !p-0;
}
:deep(.ant-table-row:last-child > td) {
  @apply !border-b-0;
}

:deep(.ant-table-cell:nth-child(2)) {
  @apply !p-0;
}

:deep(.ant-table-body) {
  @apply !p-0 w-full !overflow-y-auto;
}

:deep(.ant-table-thead > tr > th) {
  @apply !bg-transparent;
}

:deep(.ant-table-cell::before) {
  width: 0 !important;
}

:deep(.ant-table-column-sorter) {
  @apply text-gray-100 !hover:text-gray-300;
}

:deep(.ant-table-column-sorters) {
  @apply !justify-start !gap-x-2;
}
:deep(.ant-table-column-sorters > .ant-table-column-title) {
  flex: none;
}

:deep(.full-height-table .ant-table-body) {
  height: calc(100vh - var(--topbar-height) - 9rem) !important;
}
:deep(.ant-table-body) {
  overflow-y: overlay;
  height: calc(100vh - var(--topbar-height) - 13.45rem);

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }
  &::-webkit-scrollbar-thumb {
    background: #f6f6f600;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #f6f6f600;
  }
}
:deep(.ant-table-body) {
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }
  &::-webkit-scrollbar-thumb {
    background: rgb(215, 215, 215);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(203, 203, 203);
  }
}
</style>
