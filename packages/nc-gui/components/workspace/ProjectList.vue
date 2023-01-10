<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { nextTick } from '@vue/runtime-core'
import { NcProjectType, navigateTo, projectThemeColors, timeAgo, useWorkspaceStoreOrThrow } from '#imports'
import { useNuxtApp } from '#app'

const { projects, addToFavourite, removeFromFavourite, activePage, updateProjectTitle } = useWorkspaceStoreOrThrow()

const filteredProjects = computed(() => projects.value?.filter((p) => !p.deleted) || [])

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

const renameInput = ref<HTMLInputElement[]>()
const enableEdit = (index: number) => {
  projects.value![index]!.temp_title = projects.value![index].title
  projects.value![index]!.edit = true
  nextTick(() => {
    renameInput.value?.[0]?.focus()
    renameInput.value?.[0]?.select()
  })
}
const disableEdit = (index: number) => {
  projects.value![index]!.temp_title = null
  projects.value![index]!.edit = false
}

const customRow = (record: ProjectType) => ({
  onClick: async () => {
    if (record.type === 'docs') {
      await navigateTo(`/nc/doc/${record.id}`)
    } else {
      await navigateTo(`/nc/${record.id}`)
    }

    $e('a:project:open')
  },
  class: ['group'],
})

const columns = [
  {
    title: 'Project Name',
    dataIndex: 'title',
    sorter: {
      compare: (a, b) => a.title?.localeCompare(b.title),
      multiple: 4,
    },
  },
  {
    title: 'Project Type',
    dataIndex: 'type',
    sorter: {
      compare: (a, b) => a.type?.localeCompare(b.type),
      multiple: 3,
    },
  },
  {
    title: 'Last Accessed',
    dataIndex: 'updated_at',
    sorter: {
      compare: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
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
    dataIndex: 'id'
  },
]
</script>

<template>
  <div>
    <table v-if="projects?.length" class="nc-project-list-table">
      <thead>
        <tr class="!font-weight-[300]">
          <th>Project Name</th>
          <th>Project Type</th>
          <th>Last Accessed</th>
          <th>My Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(project, i) of filteredProjects">
          <tr
            v-if="project.starred || activePage !== 'starred'"
            :key="i"
            class="group cursor-pointer hover:bg-gray-50"
            @click="openProject(project)"
          >
            <td class="!py-0">
              <div class="flex items-center nc-project-title gap-2">
                <div @click.stop>
                  <a-dropdown :trigger="['click']" @click.stop>
                    <!--                  todo: allow based on role -->
                    <span class="block w-2 h-6 rounded-sm" :style="{ backgroundColor: getProjectPrimary(project) }" />
                    <template #overlay>
                      <a-menu trigger-sub-menu-action="click">
                        <a-menu-item>
                          <LazyGeneralColorPicker
                            :model-value="getProjectPrimary(project)"
                            :colors="projectThemeColors"
                            :row-size="9"
                            :advanced="false"
                            @input="handleProjectColor(project.id, $event)"
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

                          <LazyGeneralChromeWrapper @input="handleProjectColor(project.id, $event)" />
                        </a-sub-menu>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
                <div @click.stop>
                  <input
                    v-if="project.edit"
                    ref="renameInput"
                    v-model="project.temp_title"
                    class="!leading-none outline-none bg-transparent min-w-20 !w-auto"
                    autofocus
                    @blur="disableEdit(i)"
                    @keydown.enter="updateProjectTitle(project)"
                    @keydown.esc="disableEdit(i)"
                  />

                  <div v-else @dblclick="enableEdit(i)">
                    {{ project.title }}
                  </div>
                </div>
                <div @click.stop>
                  <MdiStar v-if="project.starred" class="text-yellow-400" @click="removeFromFavourite(project.id)" />
                  <MdiStarOutline
                    v-else
                    class="opacity-0 group-hover:opacity-100 transition transition-opacity text-yellow-400"
                    @click="addToFavourite(project.id)"
                  />
                </div>
              </div>
            </td>
            <td>
              <div class="flex items-center gap-2 text-center">
                <!-- todo: replace with switch -->
                <MaterialSymbolsDocs v-if="project.type === NcProjectType.DOCS" class="text-[#247727] text-sm" />
                <MdiVectorTriangle v-else-if="project.type === NcProjectType.COWRITER" class="text-[#8626FF] text-sm" />
                <MdiTransitConnectionVariant
                  v-else-if="project.type === NcProjectType.AUTOMATION"
                  class="text-[#DDB00F] text-sm"
                />
                <MdiDatabaseOutline v-else class="text-[#2824FB] text-sm" />
              </div>
            </td>
            <td class="text-gray-500 text-xs">{{ timeAgo(project.updated_at) }}</td>
            <td class="text-xs text-gray-500">
              {{ roleAlias[project.workspace_role || project.project_role] }}
            </td>
            <td>
              <a-dropdown v-if="isUIAllowed('')">
                <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu" @click.stop />
                <template #overlay>
                  <a-menu>
                    <a-menu-item @click="deleteProject(project)">
                      <div class="flex flex-row items-center py-3 gap-2">
                        <MdiDeleteOutline />
                        Delete Project
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Project list is empty" />

    <a-table
      v-model:data-source="projects"
      :custom-row="customRow"
      :pagination="{ position: ['bottomCenter'] }"
      :table-layout="md ? 'auto' : 'fixed'"
      :columns="columns"
    >
      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
      </template>

      <!--      <th>Project Name</th>
      <th>Project Type</th>
      <th>Last Accessed</th>
      <th>My Role</th>
      <th>Actions</th> -->

      <!-- todo: i18n -->
      <!--      <a-table-column
        key="title"
        title="Project Name"
        data-index="title"
      > -->
      <template #bodyCell="{ column, text, record }">
        <template v-if="column.dataIndex === 'title'">
          <div class="flex items-center nc-project-title gap-2">
            <div @click.stop>
              <a-dropdown :trigger="['click']" @click.stop>
                <!--                  todo: allow based on role -->
                <span class="block w-2 h-6 rounded-sm" :style="{ backgroundColor: getProjectPrimary(record) }" />
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
            <div @click.stop>
              <input
                v-if="record.edit"
                ref="renameInput"
                v-model="record.temp_title"
                class="!leading-none outline-none bg-transparent min-w-20 !w-auto"
                autofocus
                @blur="disableEdit(i)"
                @keydown.enter="updateProjectTitle(record)"
                @keydown.esc="disableEdit(i)"
              />

              <div v-else @dblclick="enableEdit(i)">
                {{ record.title }}
              </div>
            </div>
            <div @click.stop>
              <MdiStar v-if="record.starred" class="text-yellow-400" @click="removeFromFavourite(record.id)" />
              <MdiStarOutline
                v-else
                class="opacity-0 group-hover:opacity-100 transition transition-opacity text-yellow-400"
                @click="addToFavourite(record.id)"
              />
            </div>
          </div>
        </template>

        <!-- todo: i18n -->
        <!--      <a-table-column
        key="title"
        title="Project Type"
        data-index="type"
      > -->
        <template v-if="column.dataIndex === 'type'">
          <div class="flex items-center gap-2 text-center">
            <!-- todo: replace with switch -->
            <MaterialSymbolsDocs v-if="text === NcProjectType.DOCS" class="text-[#247727] text-sm" />
            <MdiVectorTriangle v-else-if="text === NcProjectType.COWRITER" class="text-[#8626FF] text-sm" />
            <MdiTransitConnectionVariant v-else-if="text === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-sm" />
            <MdiDatabaseOutline v-else class="text-[#2824FB] text-sm" />
          </div>
        </template>
        <!--      </a-table-column>

      &lt;!&ndash; todo: i18n &ndash;&gt;
      <a-table-column
        key="title"
        title="Last Accessed"
        data-index="updated_at"
      > -->
        <template v-if="column.dataIndex === 'updated_at'">
          {{ timeAgo(text) }}
        </template>
        <!--      </a-table-column>
      &lt;!&ndash; todo: i18n &ndash;&gt;
      <a-table-column
        key="title"
        title="My Role"
        data-index="id"
      > -->
        <template v-if="column.dataIndex === 'id'">
          {{ roleAlias[record.workspace_role || record.project_role] }}
        </template>
        <!--      </a-table-column> -->

        <template v-if="column.dataIndex === 'action'">
          <!--      &lt;!&ndash; Actions &ndash;&gt; -->
          <!--      <a-table-column key="id" :title="$t('labels.actions')" data-index="id"> -->
          <!--        <template #default="{ text, record }"> -->
          <div class="flex items-center gap-2">
            <MdiEditOutline v-e="['c:project:edit:rename']" class="nc-action-btn" @click.stop="navigateTo(`/${text}`)" />

            <MdiDeleteOutline
              class="nc-action-btn"
              :data-testid="`delete-project-${record.title}`"
              @click.stop="deleteProject(record)"
            />
          </div>
        </template>
      </template>
      <!--      </a-table-column> -->
    </a-table>
  </div>
</template>

<style scoped lang="scss">
.nc-project-list-table {
  @apply min-w-[700px] !w-full;

  th {
    @apply .font-normal !text-gray-400 pb-4;
    border-bottom: 1px solid #e3e3e3;
  }

  td {
    @apply .font-normal pb-4;
    border-bottom: 1px solid #f5f5f5;
  }

  th,
  td {
    @apply text-left p-4;
  }

  th:first-child,
  td:first-child {
    @apply pl-6;
  }

  th:last-child,
  td:last-child {
    @apply pr-6;
  }
}
</style>
