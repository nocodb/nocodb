<script setup lang="ts">
import {definePageMeta, onMounted, useSidebar} from '#imports'
import {useNuxtApp} from '#app'
import {Empty, message} from 'ant-design-vue';
import {extractSdkResponseErrorMsg} from "~/utils";

definePageMeta({
  layout: 'empty',
})

// todo: make it customizable
const stringToColour = function (str: string) {
  let i
  let hash = 0
  for (i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let colour = '#'
  for (i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    colour += `00${value.toString(16)}`.substr(-2)
  }
  return colour
}

// todo: load using api
const workspaces = $ref([
  {
    title: 'Noco 1',
    description: 'Description 1',
  },
  {
    title: 'Workspace 2',
    description: 'Description 1',
  },
  {
    title: 'Test 3',
    description: 'Description 1',
  },
  {
    title: 'Test work 4',
    description: 'Description 1',
  },
  {
    title: 'ABC 5',
    description: 'Description 1',
  },
  {
    title: 'Recent',
    description: 'Description 1',
  },
  {
    title: 'Favourites',
    description: 'Description 1',
  },
])

/* // todo: load using api
const projects = $ref([
  {
    title: 'Noco 1',
    description: 'Description 1',
    role: 'Admin',
    types: [ProjectType.DB, ProjectType.DOCS],
  },
  {
    title: 'Workspace 2',
    description: 'Description 1',
    role: 'Viewer',
    types: [ProjectType.AUTOMATION],
  },
  {
    title: 'Test 3',
    description: 'Description 1',
    role: 'Admin',
    types: [ProjectType.DB, ProjectType.AUTOMATION, ProjectType.DOCS],
  },
  {
    title: 'Test work 4',
    description: 'Description 1',
    role: 'Viewer',
    types: [ProjectType.DB, ProjectType.DOCS],
  },
  {
    title: 'ABC 5',
    description: 'Description 1',
    role: 'Editor',
    types: [ProjectType.DOCS],
  },
  {
    title: 'Recent',
    description: 'Description 1',
    role: 'Admin',
    types: [ProjectType.DB],
  },
  {
    title: 'Favourites',
    description: 'Description 1',
    role: 'Editor',
    types: [ProjectType.DOCS, ProjectType.DB],
  },
]) */

/* // todo: load using api
const collaborators = $ref([
  {
    title: 'Sam',
    role: 'Viewer',
  },
  {
    title: 'John',
    role: 'Admin',
  },
  {
    title: 'Alex',
    role: 'Viewer',
  },
  {
    title: 'Samuel',
    role: 'Editor',
  },
  {
    title: 'George',
    role: 'Admin',
  },
]) */

const selectedWorkspaceIndex = $ref([0])
const selectedWorkspace = $computed(() => workspaces[selectedWorkspaceIndex[0]])

// create a new sidebar state
const {isOpen, toggle, toggleHasSidebar} = useSidebar('nc-left-sidebar', {hasSidebar: false, isOpen: false})

const {$api} = useNuxtApp()

const loadWorkspaceList = async () => {
  try {
    // todo: pagination
    const {list, pageInfo: _} = await $api.workspace.list();
    workspaces = list
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(async () => {
  toggle(true)
  toggleHasSidebar(true)
  // await loadWorkspaceList()
})
</script>

<template>
  <NuxtLayout>
    <!--    todo: change class name -->
    <a-layout class="nc-root">
      <!--    <template #sidebar v-if="isOpen"> -->
      <a-layout-sider
          ref="sidebar"
          :collapsed="!isOpen"
          width="250"
          collapsed-width="50"
          class="relative shadow-md h-full z-1 nc-left-sidebar"
          :trigger="null"
          collapsible
          theme="light"
      >
        <div id="nc-sidebar-left" ref="sidebar">
          <div class="flex items-center uppercase !text-gray-400 text-xs font-weight-bold p-4">
            All workspaces
            <div class="flex-grow"></div>
            <MdiPlus class="!text-gray-400 text-lg"/>
          </div>


          <a-empty v-if="!workspaces?.length" :image="Empty.PRESENTED_IMAGE_SIMPLE"/>

          <a-menu v-else v-model:selected-keys="selectedWorkspaceIndex" class="nc-workspace-list">
            <a-menu-item v-for="(workspace, i) of workspaces" :key="i">
              <div class="nc-workspace-list-item">
                <div class="nc-workspace-avatar" :style="{ backgroundColor: stringToColour(workspace.title) }">
                  <span class="color-band" :style="{ backgroundColor: stringToColour(workspace.title) }"/>
                  {{ workspace.title.slice(0, 2) }}
                </div>
                <div class="nc-workspace-title">{{ workspace.title }}</div>
                <div class="flex-grow"></div>

                <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu"/>
              </div>
            </a-menu-item>
          </a-menu>
        </div>

        <a-divider class="!my-4"/>

        <div class="nc-workspace-group">
          <div class="nc-workspace-group-item">
            <MaterialSymbolsNestClockFarsightAnalogOutlineRounded class="nc-icon"/>
            <span>Recent</span>
          </div>
          <div class="nc-workspace-group-item">
            <MaterialSymbolsGroupsOutline class="nc-icon"/>
            <span>Shared with me</span>
          </div>
          <div class="nc-workspace-group-item">
            <MaterialSymbolsStarOutline class="nc-icon"/>
            <span>Favourites</span>
          </div>
        </div>
      </a-layout-sider>
      <!--    </template> -->

      <!--    <a-layout class="!flex-col"> -->
      <!--      <a-layout-header></a-layout-header> -->

      <div class="w-full">
        <div class="py-6">
          <div class="px-6 flex items-center">
            <h1 class="text-xl">{{ selectedWorkspace?.title }}</h1>

            <div class="flex-grow"></div>
            <a-button type="primary">
              <div class="flex items-center">
                <MdiPlus/>
                New Project
              </div>
            </a-button>
          </div>

          <a-tabs>
            <a-tab-pane key="projects" tab="All Projects" class="w-full">
              <WorkspaceProjectList/>
              <!--              <table class="nc-project-list-table">
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
                                <tr v-for="(project, i) of projects" :key="i">
                                  <td class="!py-0">
                                    <div class="flex items-center nc-project-title gap-2">
                                      <span class="color-band" :style="{ backgroundColor: stringToColour(project.title) }" />
                                      {{ project.title }}
                                    </div>
                                  </td>
                                  <td>
                                    <div class="flex items-center gap-2">
                                      <MaterialSymbolsDocs v-if="project.types?.includes(ProjectType.DOCS)" />
                                      <MdiTransitConnectionVariant v-if="project.types?.includes(ProjectType.AUTOMATION)" />
                                      <MdiDatabaseOutline v-if="project.types?.includes(ProjectType.DB)" />
                                    </div>
                                  </td>
                                  <td>{{ (i + 3) % 20 }} hours ago</td>
                                  <td>
                                    {{ project.role }}
                                  </td>
                                  <td>
                                    <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu" />
                                  </td>
                                </tr>
                              </tbody>
                            </table> -->
            </a-tab-pane>
            <a-tab-pane key="collab" tab="Collaborators" class="w-full">
              <WorkspaceCollaboratorsList/>
              <!--              <table class="nc-project-list-table">
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
                                <tr v-for="(project, i) of projects" :key="i">
                                  <td class="!py-0">
                                    <div class="flex items-center nc-project-title gap-2">
                                      <span class="color-band" :style="{ backgroundColor: stringToColour(project.title) }" />
                                      {{ project.title }}
                                    </div>
                                  </td>
                                  <td>
                                    <div class="flex items-center gap-2">
                                      <MaterialSymbolsDocs v-if="project.types?.includes(ProjectType.DOCS)" />
                                      <MdiTransitConnectionVariant v-if="project.types?.includes(ProjectType.AUTOMATION)" />
                                      <MdiDatabaseOutline v-if="project.types?.includes(ProjectType.DB)" />
                                    </div>
                                  </td>
                                  <td>{{ (i + 3) % 20 }} hours ago</td>
                                  <td>
                                    {{ project.role }}
                                  </td>
                                  <td>
                                    <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu" />
                                  </td>
                                </tr>
                              </tbody>
                            </table> -->
            </a-tab-pane>

            <a-tab-pane key="settings" tab="Settings"></a-tab-pane>
          </a-tabs>
        </div>
      </div>

      <!--
            <a-layout-sider
                ref="sidebar"
                :collapsed="!isOpen"
                width="250"
                collapsed-width="50"
                class="relative shadow-md h-full z-1 nc-left-sidebar"
                :trigger="null"
                collapsible
                theme="light"
            >
              <div class="flex items-center uppercase !text-gray-400 text-xs font-weight-bold p-4">
                Collaborators
              </div>

              <div class="nc-collab-list">
                <div v-for="collaborator of collaborators" class="nc-collab-list-item">
                  <div class="nc-collab-avatar" :style="{ backgroundColor: stringToColour(collaborator.title) }">
                    {{ collaborator.title.slice(0, 2) }}
                  </div>

                  {{ collaborator.title }} <span class="!text-gray-400 text-xs">({{ collaborator.role }})</span>
                </div>
              </div>

            </a-layout-sider> -->
    </a-layout>
    <!--    </a-layout> -->
    <!--  </a-layout> -->
  </NuxtLayout>
</template>

<style scoped lang="scss">
.nc-workspace-avatar {
  @apply w-6 h-6 rounded-[6px] flex items-center justify-center text-white font-weight-bold uppercase;
  font-size: 0.7rem;
}

.nc-workspace-list {
  .nc-workspace-list-item {
    @apply flex gap-2 items-center;
  }

  :deep(.ant-menu-item) {
    @apply relative;

    & .color-band {
      @apply opacity-0 absolute w-2 h-7 -left-1 top-[6px] bg-[#4351E8] rounded-[99px] content-[''] trasition-opacity;
    }
  }

  :deep(.ant-menu-item-selected, .ant-menu-item-active) .color-band {
    @apply opacity-100;
  }

  .nc-workspace-menu {
    @apply opacity-0 transition-opactity;
  }

  :deep(.ant-menu-item:hover) .nc-workspace-menu {
    @apply opacity-100;
  }
}

:deep(.nc-workspace-list .ant-menu-item) {
  @apply !my-0;
}

.nc-workspace-group {
  .nc-workspace-group-item {
    @apply h-[40px] px-4 flex items-center gap-2;

    .nc-icon {
      @apply w-6;
    }
  }
}

// todo:  apply globally at windicss level
.nc-root {
  @apply text-[#4B5563];
}

.nc-collab-list {
  .nc-collab-list-item {
    @apply flex gap-2 py-2 px-4 items-center;

    .nc-collab-avatar {
      @apply w-6 h-6 rounded-full flex items-center justify-center text-white font-weight-bold uppercase;
      font-size: 0.7rem;
    }
  }
}

:deep(.ant-tabs-nav-list) {
  @apply ml-6;
}
</style>
