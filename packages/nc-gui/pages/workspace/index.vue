<script setup lang="ts">
import type { Menu } from 'ant-design-vue'
import { Empty, Modal } from 'ant-design-vue'
import type { WorkspaceType } from 'nocodb-sdk'
import { nextTick } from '@vue/runtime-core'
import {
  NcProjectType,
  computed,
  definePageMeta,
  onMounted,
  stringToColour,
  useProvideWorkspaceStore,
  useRouter,
  useSidebar,
} from '#imports'

definePageMeta({
  layout: 'empty',
  hideHeader: true,
})

// todo: make it customizable

const { deleteWorkspace: _deleteWorkspace, loadWorkspaceList, workspaces, activeWorkspace } = useProvideWorkspaceStore()

const selectedWorkspaceIndex = computed<number[]>({
  get() {
    return [workspaces?.value?.indexOf(activeWorkspace.value!)]
  },
  set(index: number[]) {
    if (index?.length) {
      activeWorkspace.value = workspaces.value?.[index[0]]
    } else {
      activeWorkspace.value = null
    }
  },
})

// create a new sidebar state
const { isOpen, toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

const isCreateDlgOpen = ref(false)

const menu = ref<typeof Menu>()

const { close } = useDialog(resolveComponent('WorkspaceCreateDlg'), {
  'modelValue': isCreateDlgOpen,
  'onUpdate:modelValue': (isOpen: boolean) => (isCreateDlgOpen.value = isOpen),
  'onSuccess': async () => {
    isCreateDlgOpen.value = false
    await loadWorkspaceList()
    nextTick(() => {
      // menu.value?.$el?.querySelectorAll('li.ant-menu-item')?.pop()?.scrollIntoView({
      //   block: 'nearest',
      //   inline: 'nearest'
      // })
    })
  },
})

// TODO
loadWorkspaceList()

onMounted(async () => {
  toggle(true)
  toggleHasSidebar(true)
  await loadWorkspaceList()
})

const deleteWorkspace = (workspace: WorkspaceType) => {
  Modal.confirm({
    title: 'Are you sure you want to delete this workspace?',
    type: 'warn',
    onOk: async () => {
      await _deleteWorkspace(workspace.id)
      await loadWorkspaceList()
    },
  })
}

const router = useRouter()

const navigateToCreateProject = (type: NcProjectType) => {
  if (type === NcProjectType.AUTOMATION) {
    return message.info('Automation is not available at the moment')
  } else {
    router.push({
      path: '/create',
      query: {
        type,
        workspaceId: activeWorkspace.value.id,
      },
    })
  }
}
</script>

<template>
  <NuxtLayout>
    <a-layout-header class="h-20 !px-2">
      <div class="flex w-full h-full items-center">
        <div class="flex-1 min-w-0 w-50">
          <img src="~/assets/img/brand/nocodb-full-color.png" class="h-12" />
        </div>

        <div class="flex gap-1">
          <a-button ghost class="!text-inherit"> Workspaces</a-button>
          <a-button ghost class="!text-inherit"> Explore</a-button>
          <a-button ghost class="!text-inherit"> Help</a-button>
          <a-button ghost class="!text-inherit"> Community</a-button>
        </div>
        <div class="flex-1 min-w-0 flex justify-end gap-2">
          <div class="nc-quick-action-wrapper">
            <MaterialSymbolsSearch class="nc-quick-action-icon" />
            <input class="" placeholder="Quick Actions" />

            <span class="nc-quick-action-shortcut">⌘ K</span>
          </div>

          <div class="flex items-center">
            <MdiBellOutline class="text-xl" />
            <MaterialSymbolsKeyboardArrowDownRounded />
          </div>
          <div class="flex items-center gap-1">
            <div class="h-14 w-14 rounded-full bg-primary flex items-center justify-center font-weight-bold text-white">AB</div>
            <MaterialSymbolsKeyboardArrowDownRounded />
          </div>
        </div>
      </div>
    </a-layout-header>

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
        <div class="h-[calc(100vh_-_80px)] flex flex-col min-h-[400px] overflow-auto">
          <div class="flex items-center uppercase !text-gray-400 text-xs font-weight-bold p-4">
            All workspaces
            <div class="flex-grow"></div>
            <MdiPlus class="!text-gray-400 text-lg cursor-pointer" @click="isCreateDlgOpen = true" />
          </div>

          <div class="overflow-auto flex-grow min-h-25" style="flex-basis: 0px">
            <a-empty v-if="!workspaces?.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" />

            <a-menu v-else ref="menu" v-model:selected-keys="selectedWorkspaceIndex" class="nc-workspace-list">
              <a-menu-item v-for="(workspace, i) of workspaces" :key="i">
                <div class="nc-workspace-list-item">
                  <div class="nc-workspace-avatar" :style="{ backgroundColor: stringToColour(workspace.title) }">
                    <span class="color-band" :style="{ backgroundColor: stringToColour(workspace.title) }" />
                    {{ workspace.title?.slice(0, 2) }}
                  </div>
                  <div class="nc-workspace-title">{{ workspace.title }}</div>
                  <div class="flex-grow"></div>
                  <a-dropdown>
                    <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu" />

                    <template #overlay>
                      <a-menu>
                        <a-menu-item @click="deleteWorkspace(workspace)">
                          <div class="flex flex-row items-center py-3 gap-2">
                            <MdiDeleteOutline />
                            Delete Workspace
                          </div>
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
              </a-menu-item>
            </a-menu>
          </div>

          <a-divider class="!my-4" />

          <div class="nc-workspace-group overflow-auto flex-shrink scrollbar-thin-dull">
            <div class="nc-workspace-group-item">
              <MaterialSymbolsNestClockFarsightAnalogOutlineRounded class="nc-icon" />
              <span>Recent</span>
            </div>
            <div class="nc-workspace-group-item">
              <MaterialSymbolsGroupsOutline class="nc-icon" />
              <span>Shared with me</span>
            </div>
            <div class="nc-workspace-group-item">
              <MaterialSymbolsStarOutline class="nc-icon" />
              <span>Favourites</span>
            </div>
          </div>
        </div>
      </a-layout-sider>
      <!--    </template> -->

      <!--    <a-layout class="!flex-col"> -->
      <!--      <a-layout-header></a-layout-header> -->

      <div class="w-full py-6 overflow-auto">
        <div v-if="activeWorkspace">
          <div class="px-6 flex items-center">
            <div class="flex gap-2 items-center mb-4">
              <span class="nc-workspace-avatar !w-8 !h-8" :style="{ backgroundColor: stringToColour(activeWorkspace?.title) }">
                {{ activeWorkspace?.title?.slice(0, 2) }}
              </span>
              <h1 class="text-xl mb-0">{{ activeWorkspace?.title }}</h1>
            </div>
            <div class="flex-grow"></div>
            <a-dropdown>
              <a-button type="primary">
                <div class="flex items-center gap-2">
                  New Project
                  <MdiMenuDown />
                </div>
              </a-button>
              <template #overlay>
                <a-menu mode="vertical">
                  <a-menu-item @click="navigateToCreateProject(NcProjectType.DB)">
                    <div class="py-4 px-1 flex items-center gap-4">
                      <MdiDatabaseOutline class="text-[#2824FB] text-lg" />
                      New Database
                    </div>
                  </a-menu-item>
                  <a-menu-item @click="navigateToCreateProject(NcProjectType.AUTOMATION)">
                    <div class="py-4 px-1 flex items-center gap-4">
                      <MdiTransitConnectionVariant class="text-[#DDB00F] text-lg" />
                      New Automation
                    </div>
                  </a-menu-item>
                  <a-menu-item @click="navigateToCreateProject(NcProjectType.DOCS)">
                    <div class="py-4 px-1 flex items-center gap-4">
                      <MaterialSymbolsDocs class="text-[#247727] text-lg" />
                      New Documentation
                    </div>
                  </a-menu-item>
                  <a-menu-item @click="navigateToCreateProject(NcProjectType.GPT)">
                    <div class="py-4 px-1 flex items-center gap-4">
                      <MdiVectorTriangle class="text-[#8626FF] text-lg" />
                      New GPT
                    </div>
                  </a-menu-item>
                  <!-- TODO: support preset template import in the future -->
                  <!--                  <a-sub-menu> -->
                  <!--                    <template #title> -->
                  <!--                      <div class="py-4 px-1 flex items-center gap-4"> -->
                  <!--                        <MdiVectorTriangle class="text-[#8626FF] text-lg" /> -->
                  <!--                        New GPT -->
                  <!--                      </div> -->
                  <!--                    </template> -->
                  <!--                    <a-menu-item key="create-from-blank-template" @click="navigateToCreateProject(NcProjectType.GPT)"> -->
                  <!--                      <div class="flex items-center px-1 py-2 gap-1">Create from Blank Template</div> -->
                  <!--                    </a-menu-item> -->
                  <!--                    <a-menu-item key="create-from-preset-template" @click="navigateToCreateProject(NcProjectType.GPT)"> -->
                  <!--                      <div class="flex items-center px-1 py-2 gap-1">Create from Preset Template</div> -->
                  <!--                    </a-menu-item> -->
                  <!--                  </a-sub-menu> -->
                </a-menu>
              </template>
            </a-dropdown>
          </div>

          <a-tabs>
            <a-tab-pane key="projects" tab="All Projects" class="w-full">
              <WorkspaceProjectList />
            </a-tab-pane>
            <a-tab-pane key="collab" tab="Collaborators" class="w-full">
              <WorkspaceCollaboratorsList />
            </a-tab-pane>

            <a-tab-pane key="settings" tab="Settings"></a-tab-pane>
          </a-tabs>
        </div>
      </div>
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

.ant-layout-header {
  @apply !h-20 bg-transparent;
  border-bottom: 1px solid #f5f5f5;
}

.nc-quick-action-wrapper {
  @apply relative;

  input {
    @apply h-10 w-60 bg-gray-100 rounded-md pl-9 pr-5 mr-2;
  }

  .nc-quick-action-icon {
    @apply absolute left-2 top-6;
  }

  .nc-quick-action-shortcut {
    @apply text-gray-400 absolute right-4 top-0;
  }
}
</style>
