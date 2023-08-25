<script setup lang="ts">
import type { Menu } from 'ant-design-vue'
import { nextTick } from '@vue/runtime-core'
import { WorkspaceStatus } from 'nocodb-sdk'
import { computed, onMounted, storeToRefs, useRouter, useSidebar, useWorkspace } from '#imports'

const router = useRouter()

const { isUIAllowed } = useUIPermission()

const workspaceStore = useWorkspace()
const { deleteWorkspace: _deleteWorkspace, loadWorkspaces, populateWorkspace } = workspaceStore
const { workspacesList, activeWorkspace, activePage, collaborators, activeWorkspaceId } = storeToRefs(workspaceStore)

const projectsStore = useProjects()
const { loadProjects } = projectsStore

const route = router.currentRoute

const selectedWorkspaceIndex = computed<number[]>({
  get() {
    const index = workspacesList?.value?.findIndex((workspace) => workspace.id === (route.value.query?.workspaceId as string))
    return activePage?.value === 'workspace' ? [index === -1 ? 0 : index] : []
  },
  set(index: number[]) {
    if (index?.length) {
      router.push({ query: { workspaceId: workspacesList.value?.[index[0]]?.id, page: 'workspace' } })
    } else {
      router.push({ query: {} })
    }
  },
})

// create a new sidebar state
const { toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

const isCreateDlgOpen = ref(false)

const isCreateProjectOpen = ref(false)

const menuEl = ref<typeof Menu | null>(null)

onMounted(async () => {
  toggle(true)
  toggleHasSidebar(true)

  loadProjects('recent')
})

watch(
  () => route.value.query.workspaceId,
  async (newId, oldId) => {
    if (!newId || (oldId !== newId && oldId)) {
      projectsStore.clearProjects()
      collaborators.value = []
    }

    if (newId) {
      populateWorkspace()
    }
  },
  {
    immediate: true,
  },
)

const tab = computed({
  get() {
    return route.value.query?.tab ?? 'projects'
  },
  set(tab: string) {
    router.push({ query: { ...route.value.query, tab } })
  },
})

const projectListType = computed(() => {
  switch (activePage.value) {
    case 'recent':
      return 'Recent'
    case 'shared':
      return 'Shared With Me'
    case 'starred':
      return 'Starred'
    default:
      return '='
  }
})

watch(activeWorkspaceId, async () => {
  if (activeWorkspace.value?.status !== WorkspaceStatus.CREATED) return
  await loadProjects(activePage.value)
})

watch(
  () => activeWorkspace.value?.status,
  async (status) => {
    if (status === WorkspaceStatus.CREATED) {
      await loadProjects()
    }
  },
)
</script>

<template>
  <NuxtLayout name="new">
    <template #sidebar>
      <div class="h-full flex flex-col min-h-[400px] overflow-auto">
        <div class="nc-workspace-group overflow-auto mt-8.5">
          <div class="flex text-sm font-medium text-gray-400 mx-4.5 mb-2">All Projects</div>
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
            <IcOutlineAccessTime class="nc-icon" />
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
            <MaterialSymbolsGroupOutlineRounded class="nc-icon" />
            <span>Shared with me</span>
          </div>
          <div
            v-if="false"
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
            <IcRoundStarBorder class="nc-icon !h-5" />
            <span>Starred</span>
          </div>
        </div>
      </div>
    </template>

    <div class="h-full nc-workspace-container overflow-x-hidden" style="width: calc(100vw - 250px)">
      <div class="h-full flex flex-col px-6 mt-3">
        <div class="flex items-center gap-2 mb-5.5 mt-4 text-xl ml-5.5">
          <h2 class="text-3xl font-weight-bold tracking-[0.5px] mb-0">
            {{ projectListType }}
          </h2>

          <div class="flex-grow min-w-10"></div>
          <WorkspaceCreateProjectBtn
            v-if="isUIAllowed('projectCreate', false) && tab === 'projects'"
            v-model:is-open="isCreateProjectOpen"
            class="mt-0.75"
            type="primary"
            :active-workspace-id="activeWorkspace?.id"
            modal
          >
            <div
              class="gap-x-2 flex flex-row w-full items-center rounded py-1.5 pl-2 pr-2.75"
              :class="{
                '!bg-opacity-10': isCreateProjectOpen,
              }"
            >
              <MdiPlus class="!h-4.2" />

              <div class="flex">{{ $t('title.newProj') }}</div>
            </div>
          </WorkspaceCreateProjectBtn>
        </div>

        <WorkspaceProjectList class="min-h-20 grow" />
      </div>
    </div>
  </NuxtLayout>
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

  .nc-workspace-menu,
  .nc-workspace-drag-icon {
    @apply opacity-0 transition-opactity min-w-4 text-gray-500;
  }

  .nc-workspace-drag-icon {
    @apply cursor-move;
  }

  :deep(.ant-menu-item:hover) {
    .nc-workspace-menu,
    .nc-workspace-drag-icon {
      @apply opacity-100;
    }
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
      @apply bg-primary bg-opacity-8 text-primary font-weight-bold;
    }

    @apply h-[40px]  p-4 pl-3 flex items-center gap-2 cursor-pointer;

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
  @apply !ml-6;
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

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}
</style>
