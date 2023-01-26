<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { nextTick } from '@vue/runtime-core'
import { NcProjectType, navigateTo, projectThemeColors, timeAgo, useWorkspaceStoreOrThrow } from '#imports'
import { useNuxtApp } from '#app'

const { projects, addToFavourite, removeFromFavourite, updateProjectTitle, activePage } = useWorkspaceStoreOrThrow()

// const filteredProjects = computed(() => projects.value?.filter((p) => !p.deleted) || [])

const { $e, $api } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const openProject = async (project: ProjectType) => {
  switch (project.type) {
    case NcProjectType.DOCS:
      await navigateTo(`/nc/doc/${project.id}`)
      break
    case NcProjectType.COWRITER:
      await navigateTo(`/nc/cowriter/${project.id}`)
      break
    default:
      await navigateTo(`/nc/${project.id}`)
      break
  }
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

        projects.value?.splice(projects.value?.indexOf(project), 1)
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
    const localProject = projects.value?.find((p) => p.id === projectId)

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
  projects.value![index]!.temp_title = projects.value![index].title
  projects.value![index]!.edit = true
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}
const disableEdit = (index: number) => {
  projects.value![index]!.temp_title = null
  projects.value![index]!.edit = false
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
    title: 'Color',
    dataIndex: 'type',
    // sorter: {
    //   compare: (a, b) => a.type?.localeCompare(b.type),
    //   multiple: 3,
    // },
  },
  {
    title: 'Last Accessed',
    dataIndex: 'last_accessed',
    sorter: {
      compare: (a, b) => new Date(b.last_accessed) - new Date(a.last_accessed),
      multiple: 2,
    },
  },
  {
    title: 'My Role',
    dataIndex: 'workspace_role',
    sorter: {
      compare: (a, b) => a - b,
      multiple: 1,
    },
  },
  {
    title: 'Actions',
    dataIndex: 'id',
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

let clickCount = 0
let timer: any = null
const delay = 250

function onProjectTitleClick(index: number) {
  clickCount++
  if (clickCount === 1) {
    timer = setTimeout(function () {
      openProject(projects.value![index])
      clickCount = 0
    }, delay)
  } else {
    clearTimeout(timer)
    enableEdit(index)
    clickCount = 0
  }
}
</script>

<template>
  <div>
    <a-table
      v-model:data-source="projects"
      class="h-full"
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
          <div class="flex items-center nc-project-title gap-2 max-w-full">
            <div class="flex items-center gap-2 text-center">
              <!-- todo: replace with switch -->
              <MaterialSymbolsDocs v-if="record.type === NcProjectType.DOCS" class="text-[#247727] text-sm" />
              <MdiVectorTriangle v-else-if="record.type === NcProjectType.COWRITER" class="text-[#8626FF] text-sm" />
              <MdiTransitConnectionVariant v-else-if="record.type === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-sm" />
              <MdiDatabaseOutline v-else class="text-[#2824FB] text-sm" />
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

            <div v-if="!record.edit" class="nc-click-transition-1" @click.stop>
              <MdiStar v-if="record.starred" class="text-yellow-400 cursor-pointer" @click="removeFromFavourite(record.id)" />
              <MdiStarOutline
                v-else
                class="opacity-0 group-hover:opacity-100 transition transition-opacity text-yellow-400 cursor-pointer"
                @click="addToFavourite(record.id)"
              />
            </div>
          </div>
        </template>

        <template v-if="column.dataIndex === 'type'">
          <div @click.stop>
            <a-dropdown :trigger="['click']" @click.stop>
              <!--                  todo: allow based on role -->
              <span
                class="block w-2 h-6 rounded-sm nc-click-transition-1"
                :style="{ backgroundColor: getProjectPrimary(record) }"
              />
              <template #overlay>
                <a-menu trigger-sub-menu-action="click">
                  <a-menu-item>
                    <LazyGeneralColorPicker
                      :model-value="getProjectPrimary(record)"
                      :colors="projectThemeColors"
                      :row-size="9"
                      :advanced="false"
                      @input="handleProjectColor(record.id, $event)"
                    />
                  </a-menu-item>
                  <a-sub-menu key="pick-primary">
                    <template #title>
                      <div class="nc-project-menu-item group !py-0">
                        <ClarityColorPickerSolid class="group-hover:text-accent" />
                        Custom Color
                      </div>
                    </template>

                    <template #expandIcon></template>

                    <LazyGeneralChromeWrapper @input="handleProjectColor(record.id, $event)" />
                  </a-sub-menu>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </template>

        <div v-if="column.dataIndex === 'last_accessed'" class="text-xs text-gray-500">
          {{ text ? timeAgo(text) : 'Newly invited' }}
        </div>

        <div v-if="column.dataIndex === 'workspace_role'" class="text-xs text-gray-500">
          {{ roleAlias[record.workspace_role || record.project_role] }}
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

        <template v-if="column.dataIndex === 'id'">
          <div class="flex items-center gap-2">
            <a-dropdown
              v-if="isUIAllowed('projectActionMenu', true, [record.workspace_role, record.project_role].join())"
              :trigger="['click']"
            >
              <div @click.stop>
                <MdiDotsHorizontal class="outline-0 nc-workspace-menu nc-click-transition" />
              </div>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="enableEdit(i)">
                    <div class="nc-menu-item-wrapper">
                      <MdiEdit class="text-gray-500" />
                      Rename Project
                    </div>
                  </a-menu-item>
                  <a-menu-item
                    v-if="isUIAllowed('moveProject', true, [record.workspace_role, record.project_role].join())"
                    @click="moveProject(record)"
                  >
                    <div class="nc-menu-item-wrapper">
                      <MdiFolderMove class="text-gray-500" />
                      Move Project
                    </div>
                  </a-menu-item>
                  <a-menu-item @click="deleteProject(record)">
                    <div class="nc-menu-item-wrapper">
                      <MdiDeleteOutline class="text-gray-500" />
                      Delete Project
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
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
</style>
