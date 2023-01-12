<script setup lang="ts">
import type { Menu } from 'ant-design-vue'
import { Empty, Modal } from 'ant-design-vue'
import type { WorkspaceType } from 'nocodb-sdk'
import { nextTick } from '@vue/runtime-core'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import Sortable from 'sortablejs'
import { useRoute } from 'vue-router'
import {
  NcProjectType,
  computed,
  definePageMeta,
  onMounted,
  projectThemeColors,
  stringToColour,
  useProvideWorkspaceStore,
  useRouter,
  useSidebar,
} from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'

definePageMeta({
  hideHeader: true,
})

const router = useRouter()

const roleAlias = {
  [WorkspaceUserRoles.OWNER]: 'Owner',
  [WorkspaceUserRoles.VIEWER]: 'Viewer',
  [WorkspaceUserRoles.CREATOR]: 'Creator',
}

// todo: make it customizable

const {
  deleteWorkspace: _deleteWorkspace,
  loadWorkspaceList,
  workspaces,
  activeWorkspace,
  isWorkspaceOwner,
  updateWorkspace,
  activePage,
} = useProvideWorkspaceStore()

const { $e } = useNuxtApp()

const route = useRoute()

const selectedWorkspaceIndex = computed<number[]>({
  get() {
    const index = workspaces?.value?.findIndex((workspace) => workspace.id === (route.query?.workspaceId as string))
    return activePage?.value === 'workspace' ? [index === -1 ? 0 : index] : []
  },
  set(index: number[]) {
    if (index?.length) {
      router.push({ query: { workspaceId: workspaces.value?.[index[0]]?.id, page: 'workspace' } })
    } else {
      router.push({ query: {} })
    }
  },
})

// create a new sidebar state
const { isOpen, toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar-workspace', { hasSidebar: true, isOpen: true })

const isCreateDlgOpen = ref(false)

const menuEl = ref<Menu | null>(null)

const menu = (el?: typeof Menu) => {
  if (el) {
    menuEl.value = el
    initSortable(el.$el)
  }
}

useDialog(resolveComponent('WorkspaceCreateDlg'), {
  'modelValue': isCreateDlgOpen,
  'onUpdate:modelValue': (isOpen: boolean) => (isCreateDlgOpen.value = isOpen),
  'onSuccess': async () => {
    isCreateDlgOpen.value = false
    await loadWorkspaceList()
    await nextTick(() => {
      ;[...menuEl?.value?.$el?.querySelectorAll('li.ant-menu-item')]?.pop()?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
      selectedWorkspaceIndex.value = [workspaces.value?.length - 1]
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
      await _deleteWorkspace(workspace.id!)
      await loadWorkspaceList()
    },
  })
}

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

const updateWorkspaceTitle = async (workspace: WorkspaceType & { edit: boolean; temp_title: string }) => {
  try {
    await updateWorkspace(workspace.id!, { title: workspace.temp_title })
    workspace.title = workspace.temp_title
    workspace.edit = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleWorkspaceColor = async (workspaceId: string, color: string) => {
  const workspace = workspaces.value?.find((w) => w.id === workspaceId)

  if (!workspace) return

  const tcolor = tinycolor(color)

  if (tcolor.isValid()) {
    const meta = workspace?.meta && typeof workspace.meta === 'string' ? JSON.parse(workspace.meta) : workspace.meta || {}

    // Update local workspace meta
    workspace.meta = {
      ...(meta || {}),
      color,
    }

    await updateWorkspace(workspace.id!, {
      meta: workspace.meta,
    })
  }
}

const getWorkspaceColor = (workspace: WorkspaceType) => workspace.meta?.color || stringToColour(workspace.id!)

// const sortables: Record<string, Sortable> = {}

function getIdFromEl(previousEl: HTMLElement) {
  return previousEl.querySelector('[data-id]')?.dataset?.id
}

// todo: replace with vuedraggable
function initSortable(el: Element) {
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      if (workspaces.value?.length < 2) return

      const { newIndex = 0, oldIndex = 0 } = evt

      if (newIndex === oldIndex) return

      const children = evt.to.children as unknown as HTMLLIElement[]

      const previousEl = children[newIndex - 1]
      const nextEl = children[newIndex + 1]

      const currentItem = workspaces.value.find((v) => v.id === getIdFromEl(evt.item))

      if (!currentItem || !currentItem.id) return

      const previousItem = (previousEl ? workspaces.value.find((v) => v.id === getIdFromEl(previousEl)) : {}) as WorkspaceType
      const nextItem = (nextEl ? workspaces.value.find((v) => v.id === getIdFromEl(nextEl)) : {}) as WorkspaceType

      let nextOrder: number

      // set new order value based on the new order of the items
      if (workspaces.value.length - 1 === newIndex) {
        nextOrder = parseFloat(String(previousItem.order)) + 1
      } else if (newIndex === 0) {
        nextOrder = parseFloat(String(nextItem.order)) / 2
      } else {
        nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
      }

      const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

      currentItem.order = _nextOrder

      await updateWorkspace(currentItem.id, { order: _nextOrder })

      $e('a:workspace:reorder')
    },
    animation: 150,
  })
}

const tab = computed({
  get() {
    return route.query?.tab ?? 'projects'
  },
  set(tab: string) {
    router.push({ query: { ...route.query, tab } })
  },
})

const renameInput = ref<HTMLInputElement[]>()
const enableEdit = (index: number) => {
  workspaces.value[index].temp_title = workspaces.value[index].title
  workspaces.value[index].edit = true
  nextTick(() => {
    renameInput.value?.[0]?.focus()
    renameInput.value?.[0]?.select()
  })
}
const disableEdit = (index: number) => {
  workspaces.value[index].temp_title = null
  workspaces.value[index].edit = false
}

const projectListType = computed(() => {
  switch (activePage.value) {
    case 'recent':
      return 'Recent'
    case 'shared':
      return 'Shared'
    case 'starred':
      return 'Favourite'
    default:
      return '='
  }
})
</script>

<template>
  <a-layout>
    <!--  <NuxtLayout> -->
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
          <div class="nc-workspace-group overflow-auto flex-shrink scrollbar-thin-dull">
            <div
              class="nc-workspace-group-item"
              :class="{ active: activePage === 'recent' }"
              @click="
                navigateTo({
                  query: {
                    page: 'recent',
                  },
                })
              "
            >
              <MaterialSymbolsNestClockFarsightAnalogOutlineRounded class="nc-icon" />
              <span>Recent</span>
            </div>
            <div
              class="nc-workspace-group-item"
              :class="{ active: activePage === 'shared' }"
              @click="
                navigateTo({
                  query: {
                    page: 'shared',
                  },
                })
              "
            >
              <MaterialSymbolsGroupsOutline class="nc-icon" />
              <span>Shared with me</span>
            </div>
            <div
              class="nc-workspace-group-item"
              :class="{ active: activePage === 'starred' }"
              @click="
                navigateTo({
                  query: {
                    page: 'starred',
                  },
                })
              "
            >
              <MaterialSymbolsStarOutline class="nc-icon" />
              <span>Favourites</span>
            </div>
          </div>

          <div class="flex items-center uppercase !text-gray-400 text-xs font-weight-bold p-4">
            All workspaces
            <div class="flex-grow"></div>
            <MdiPlus class="!text-gray-400 text-lg cursor-pointer" @click="isCreateDlgOpen = true" />
          </div>

          <div class="overflow-auto flex-grow min-h-25" style="flex-basis: 0px">
            <a-empty v-if="!workspaces?.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" />

            <a-menu
              v-else
              :ref="menu"
              v-model:selected-keys="selectedWorkspaceIndex"
              class="nc-workspace-list"
              trigger-sub-menu-action="click"
            >
              <a-menu-item v-for="(workspace, i) of workspaces" :key="i">
                <div class="nc-workspace-list-item flex items-center h-full group" :data-id="workspace.id">
                  <a-dropdown :trigger="['click']" trigger-sub-menu-action="click" @click.stop>
                    <div
                      :key="workspace.meta?.color"
                      class="nc-workspace-avatar"
                      :style="{ backgroundColor: getWorkspaceColor(workspace) }"
                    >
                      <span class="color-band" :style="{ backgroundColor: getWorkspaceColor(workspace) }" />
                      {{ workspace.title?.slice(0, 2) }}
                    </div>
                    <template #overlay>
                      <a-menu trigger-sub-menu-action="click">
                        <LazyGeneralColorPicker
                          :model-value="getWorkspaceColor(workspace)"
                          :colors="projectThemeColors"
                          :row-size="9"
                          :advanced="false"
                          @input="handleWorkspaceColor(workspace.id, $event)"
                        />
                        <a-sub-menu key="pick-primary">
                          <template #title>
                            <div class="nc-project-menu-item group !py-0">
                              <ClarityColorPickerSolid class="group-hover:text-accent" />
                              Custom Color
                            </div>
                          </template>

                          <template #expandIcon></template>

                          <LazyGeneralChromeWrapper @input="handleWorkspaceColor(workspace.id, $event)" />
                        </a-sub-menu>
                      </a-menu>
                    </template>
                  </a-dropdown>
                  <input
                    v-if="workspace.edit"
                    ref="renameInput"
                    v-model="workspace.temp_title"
                    class="!leading-none outline-none bg-transparent"
                    autofocus
                    @blur="disableEdit(i)"
                    @keydown.enter="updateWorkspaceTitle(workspace)"
                    @keydown.esc="disableEdit(i)"
                  />
                  <div v-else class="nc-workspace-title shrink min-w-4 flex items-center gap-1">
                    <span
                      class="shrink min-w-0 overflow-ellipsis overflow-hidden"
                      :title="workspace.title"
                      @dblclick="enableEdit(i)"
                      >{{ workspace.title }}</span
                    >
                    <span v-if="workspace.roles" class="text-[0.7rem] text-gray-500 hidden group-hover:inline"
                      >({{ roleAlias[workspace.roles] }})</span
                    >
                  </div>
                  <div class="flex-grow"></div>
                  <a-dropdown>
                    <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu min-w-4" />

                    <template #overlay>
                      <a-menu>
                        <a-menu-item @click="enableEdit(i)">
                          <div class="flex flex-row items-center py-3 gap-2">
                            <MdiPencil />
                            Rename Workspace
                          </div>
                        </a-menu-item>
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
        </div>
      </a-layout-sider>
      <!--    </template> -->

      <!--    <a-layout class="!flex-col"> -->
      <!--      <a-layout-header></a-layout-header> -->

      <div class="w-full h-[calc(100vh_-_80px)] overflow-auto">
        <div v-if="activeWorkspace" class="h-full flex flex-col pt-6">
          <div class="px-6 flex items-center">
            <div class="flex gap-2 items-center mb-4">
              <span class="nc-workspace-avatar !w-8 !h-8" :style="{ backgroundColor: getWorkspaceColor(activeWorkspace) }">
                {{ activeWorkspace?.title?.slice(0, 2) }}
              </span>
              <h1 class="text-xl mb-0">{{ activeWorkspace?.title }}</h1>
            </div>
            <div class="flex-grow"></div>
            <a-dropdown v-if="isWorkspaceOwner">
              <a-button type="primary">
                <div class="flex items-center gap-2">
                  New Project
                  <MdiMenuDown />
                </div>
              </a-button>
              <template #overlay>
                <a-menu>
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
                  <a-menu-item @click="navigateToCreateProject(NcProjectType.COWRITER)">
                    <div class="py-4 px-1 flex items-center gap-4">
                      <MdiVectorTriangle class="text-[#8626FF] text-lg" />
                      New Cowriter
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>

          <a-tabs v-model:activeKey="tab">
            <a-tab-pane key="projects" tab="All Projects" class="w-full">
              <WorkspaceProjectList class="h-full" />
            </a-tab-pane>
            <template v-if="isWorkspaceOwner">
              <a-tab-pane key="collab" tab="Collaborators" class="w-full">
                <WorkspaceCollaboratorsList class="h-full overflow-auto" />
              </a-tab-pane>
            </template>
          </a-tabs>
        </div>
        <div v-else-if="activePage !== 'workspace'" class="h-full flex flex-col">
          <h2 class="px-6 my-3 text-xl">{{ projectListType }} Projects</h2>

          <WorkspaceProjectList class="min-h-20 grow" />
        </div>
      </div>
    </a-layout>
    <!--    </a-layout> -->
    <!--  </a-layout> -->
    <!--  </NuxtLayout> -->
  </a-layout>
</template>

<style scoped lang="scss">
.nc-workspace-avatar {
  @apply min-w-6 h-6 rounded-[6px] flex items-center justify-center text-white font-weight-bold uppercase;
  font-size: 0.7rem;
}

.nc-workspace-list {
  .nc-workspace-list-item {
    @apply flex gap-2 items-center;
  }

  :deep(.ant-menu-item) {
    @apply relative;

    & .color-band {
      @apply opacity-0 absolute w-2 h-7 -left-1 top-[6px] bg-[#4351E8] rounded-[99px] trasition-opacity;
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
    &:hover {
      @apply bg-primary bg-opacity-3 text-primary;
    }

    &.active {
      @apply bg-primary bg-opacity-8 text-primary;
    }

    @apply h-[40px] px-4 flex items-center gap-2 cursor-pointer;

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

:deep(.ant-tabs-tab:not(ant-tabs-tab-active)) {
  @apply !text-gray-500;
}

:deep(.ant-tabs-content) {
  @apply !min-h-25 !h-full;
}
</style>
