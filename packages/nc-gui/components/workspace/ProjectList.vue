<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { NcProjectType, navigateTo, stringToColour, timeAgo, useWorkspaceStoreOrThrow } from '#imports'
import { useNuxtApp } from '#app'

const { projects, loadProjects } = useWorkspaceStoreOrThrow()

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
</script>

<template>
  <div>
    <table v-if="projects?.length" class="nc-project-list-table">
      <thead>
        <tr>
          <th>Project Name</th>
          <th>Project Type</th>
          <th>Last Modified</th>
          <th>My Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(project, i) of projects" :key="i" class="cursor-pointer hover:bg-gray-50" @click="openProject(project)">
          <td class="!py-0">
            <div class="flex items-center nc-project-title gap-2">
              <div @click.stop>
                <a-dropdown :trigger="['click']" @click.stop>
                  <!--                  todo: allow based on role -->
                  <span class="block w-2 h-6 rounded-sm" :style="{ backgroundColor: getProjectPrimary(project) }" />
                  <template #overlay>
                    <a-menu>
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

              {{ project.title }}
            </div>
          </td>
          <td>
            <div class="flex items-center gap-2">
              <!-- todo: replace with switch -->
              <MaterialSymbolsDocs v-if="project.type === NcProjectType.DOCS" class="text-[#247727] text-xl" />
              <MdiVectorTriangle v-else-if="project.type === NcProjectType.COWRITER" class="text-[#8626FF] text-xl" />
              <MdiTransitConnectionVariant v-else-if="project.type === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-xl" />
              <MdiDatabaseOutline v-else class="text-[#2824FB] text-xl" />
            </div>
          </td>
          <td class="text-gray-500 text-xs">{{ timeAgo(project.created_at) }}</td>
          <td class="text-xs text-gray-500">
            {{ roleAlias[project.workspace_role || project.project_role] }}
          </td>
          <td>
            <a-dropdown>
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
      </tbody>
    </table>

    <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Project list is empty" />
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
