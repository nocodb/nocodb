<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import { NcProjectType, stringToColour, useWorkspaceStoreOrThrow, navigateTo } from '#imports'
import { ProjectType } from 'nocodb-sdk'

const { projects, loadProjects } = useWorkspaceStoreOrThrow()

const openProject = async (project: ProjectType) => {
  switch (project.type) {
    case NcProjectType.DOCS:
      await navigateTo(`/nc/doc/${project.id}`)
      break
    case NcProjectType.GPT:
      await navigateTo(`/nc/gpt/${project.id}`)
      break
    default:
      await navigateTo(`/nc/${project.id}`)
      break
  }
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
              <span class="color-band" :style="{ backgroundColor: stringToColour(project.title) }" />
              {{ project.title }}
            </div>
          </td>
          <td>
            <div class="flex items-center gap-2">
              <!-- todo: replace with switch -->
              <MaterialSymbolsDocs v-if="project.type === NcProjectType.DOCS" class="text-[#247727] text-xl" />
              <MdiVectorTriangle v-else-if="project.type === NcProjectType.GPT" class="text-[#8626FF] text-xl" />
              <MdiTransitConnectionVariant v-else-if="project.type === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-xl" />
              <MdiDatabaseOutline v-else class="text-[#2824FB] text-xl" />
            </div>
          </td>
          <td>{{ (i + 3) % 20 }} hours ago</td>
          <td>
            {{ project.role }}
          </td>
          <td>
            <a-dropdown>
              <MdiDotsHorizontal @click.stop class="!text-gray-400 nc-workspace-menu" />
              <template #overlay>
                <a-menu>
                  <a-menu-item>
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

.nc-project-title {
  .color-band {
    @apply w-6 h-6 left-0 top-[10px] rounded-md;
  }
}
</style>
