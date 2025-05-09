<script lang="ts" setup>
import { UseVirtualList } from '@vueuse/components'
import { type WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk'

const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const workspaceStore = useWorkspace()

const { activeWorkspace, workspacesList, workspaceUserCount } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { appInfo } = useGlobal()

const { leftSidebarState, isLeftSidebarOpen, nonHiddenLeftSidebarWidth: leftSidebarWidth } = storeToRefs(useSidebarStore())
const viewportWidth = ref(window.innerWidth)

const { navigateToTable } = useTablesStore()

const { $e } = useNuxtApp()

const { navigateToProject, isMobileMode } = useGlobal()

const isWorkspaceDropdownOpen = ref(false)

watch(isLeftSidebarOpen, () => {
  isWorkspaceDropdownOpen.value = false
})

const createDlg = ref(false)

const otherWorkspaces = computed(() => {
  return workspacesList.value.filter((ws) => ws.id !== activeWorkspace.value?.id)
})

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await loadWorkspaces()

  // TODO: Add to swagger
  const base = (workspace as any).bases?.[0]
  const table = base?.tables?.[0]

  if (base && table) {
    return await navigateToTable({
      baseId: base.id,
      tableId: table.id,
      workspaceId: workspace.id,
    })
  }

  navigateTo(`/${workspace.id}`)
}

const baseStore = useBase()

const { isSharedBase } = storeToRefs(baseStore)

const switchWorkspace = async (workspaceId: string) => {
  $e('a:workspace:switch')

  navigateToProject({
    workspaceId,
  })
}

watch(leftSidebarState, () => {
  if (leftSidebarState.value === 'peekCloseEnd') {
    isWorkspaceDropdownOpen.value = false
  }
})

function onWindowResize() {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
})

const onWorkspaceCreateClick = () => {
  $e('c:workspace:create')

  createDlg.value = true
}
</script>

<template>
  <div
    v-if="isSharedBase"
    class="flex flex-row flex-grow pl-0.5 pr-1 py-0.5 rounded-md w-full"
    style="max-width: calc(100% - 2.5rem)"
  >
    <div class="flex-grow min-w-20">
      <div
        data-testid="nc-workspace-menu"
        class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full"
      >
        <a
          class="w-24 min-w-10 transition-all duration-200 p-1 transform"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
        </a>

        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
  <div
    v-else-if="activeWorkspace"
    :class="{
      'flex flex-row flex-grow w-full max-w-85/100 hover:bg-gray-200 pl-2 pr-1 py-0.5 rounded-md': !isMiniSidebar,
    }"
    :style="{
      maxWidth: !isMiniSidebar ? `calc(100% - 2.5rem)` : undefined,
    }"
  >
    <NcDropdown
      v-model:visible="isWorkspaceDropdownOpen"
      class="h-full min-w-0 rounded-lg"
      :trigger="['click']"
      placement="bottom"
      overlay-class-name="nc-dropdown-workspace-menu !overflow-hidden"
    >
      <div
        v-e="['c:workspace:menu']"
        data-testid="nc-workspace-menu"
        :class="{
          'nc-mini-sidebar-btn !p-1': isMiniSidebar,
          'group cursor-pointer flex flex-grow w-full gap-x-2 items-center overflow-hidden py-1.25 xs:py-1.75 pr-0.25':
            !isMiniSidebar,
        }"
        class="nc-workspace-menu"
      >
        <GeneralWorkspaceIcon :workspace="activeWorkspace" icon-bg-color="#E7E7E9" show-nocodb-icon class="flex-none" />
        <div v-if="activeWorkspace && !isMiniSidebar" class="flex min-w-10 w-full items-center">
          <div class="nc-workspace-title font-semibold text-base text-md truncate capitalize">
            {{ activeWorkspace.title }}
          </div>
          <GeneralIcon icon="chevronDown" class="mt-0.5 ml-1 min-w-6 text-lg !text-gray-500/75" />
        </div>
      </div>

      <template #overlay>
        <NcMenu
          class="nc-workspace-dropdown-inner"
          :style="`width: ${leftSidebarWidth - 4}px`"
          @click="isWorkspaceDropdownOpen = false"
        >
          <a-menu-item-group class="!border-t-0 w-full">
            <div class="flex gap-x-3 min-w-0 pl-4 pr-3 w-full py-3 items-center">
              <GeneralWorkspaceIcon :workspace="activeWorkspace" size="large" />
              <div class="flex-1 flex flex-col gap-y-0 max-w-[calc(100%-5.6rem)]">
                <div
                  class="mt-0.5 flex w-full capitalize mb-0 nc-workspace-title truncate min-w-10 text-sm text-black font-medium"
                  style="line-height: 1.5rem"
                  data-testid="nc-workspace-list"
                >
                  <span data-testid="nc-workspace-list-title" class="truncate">
                    {{ activeWorkspace?.title }}
                  </span>
                </div>
                <div class="flex flex-row items-center gap-x-2">
                  <template v-if="appInfo.isOnPrem">
                    <template v-if="workspaceUserCount !== undefined">
                      <div class="nc-workspace-dropdown-active-workspace-info">
                        {{ workspaceUserCount }}
                        {{ workspaceUserCount > 1 ? $t('labels.members').toLowerCase() : $t('objects.member').toLowerCase() }}
                      </div>
                    </template>
                  </template>
                  <template v-else>
                    <div class="nc-workspace-dropdown-active-workspace-info">
                      {{ activeWorkspace.payment?.plan?.title || 'Free Plan' }}
                    </div>
                    <template v-if="workspaceUserCount !== undefined">
                      <div class="nc-workspace-dropdown-active-workspace-info">-</div>
                      <div class="nc-workspace-dropdown-active-workspace-info">
                        {{ workspaceUserCount }}
                        {{ workspaceUserCount > 1 ? $t('labels.members').toLowerCase() : $t('objects.member').toLowerCase() }}
                      </div>
                    </template>
                  </template>
                </div>
              </div>
              <NcTooltip
                v-if="activeWorkspace.roles === WorkspaceUserRoles.OWNER"
                class="!z-1 cursor-pointer"
                placement="bottomRight"
              >
                <template #title>
                  {{ $t('objects.roleType.owner') }}
                </template>
                <div class="h-6.5 px-1 py-0.25 rounded-lg bg-purple-50">
                  <GeneralIcon icon="role_owner" class="min-w-4.5 min-h-4.5 text-xl !text-purple-700 !hover:text-purple-700" />
                </div>
              </NcTooltip>
            </div>

            <NcDivider v-if="!isMobileMode" class="!mb-0" />

            <UseVirtualList
              :list="otherWorkspaces"
              height="auto"
              :options="{ itemHeight: 40 }"
              class="mt-1 max-h-300px nc-scrollbar-md"
            >
              <template #default="{ data: workspace }">
                <NcMenuItem :key="workspace.id!" class="!h-[40px]" @click="switchWorkspace(workspace.id!)">
                  <div
                    class="nc-workspace-menu-item group capitalize max-w-[calc(100%-3.5rem)] flex items-center"
                    data-testid="nc-workspace-list"
                    :style="`width: ${leftSidebarWidth + 26}px`"
                  >
                    <div class="flex flex-row w-[calc(100%-2rem)] truncate items-center gap-2">
                      <GeneralWorkspaceIcon :workspace="workspace" size="medium" />
                      <span data-testid="nc-workspace-list-title" class="capitalize mb-0 nc-workspace-title truncate min-w-10">
                        {{ workspace?.title }}
                      </span>
                    </div>

                    <NcTooltip v-if="workspace.roles === WorkspaceUserRoles.OWNER" class="!z-1" placement="bottomRight">
                      <template #title>
                        {{ $t('objects.roleType.owner') }}
                      </template>
                      <div class="h-6.5 px-1 py-0.25 rounded-lg bg-purple-50">
                        <GeneralIcon
                          icon="role_owner"
                          class="min-w-4.5 min-h-4.5 text-xl !text-purple-700 !hover:text-purple-700"
                        />
                      </div>
                    </NcTooltip>
                  </div>
                </NcMenuItem>
              </template>
            </UseVirtualList>
            <NcDivider v-if="otherWorkspaces.length && !isMobileMode" class="!mt-0" />
            <NcMenuItem v-if="!isMobileMode" @click="onWorkspaceCreateClick">
              <div v-e="['c:workspace:create']" class="nc-workspace-menu-item group">
                <GeneralIcon icon="plusSquare" class="!text-inherit" />

                <div class="">{{ $t('general.create') }} {{ $t('general.new') }} {{ $t('objects.workspace') }}</div>
              </div>
            </NcMenuItem>
          </a-menu-item-group>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
</template>

<style scoped lang="scss">
:deep(.nc-dropdown) {
  @apply z-40;
}

:deep(.ant-dropdown-menu-title-content) {
  @apply !flex !w-full;
}

.nc-workspace-menu-item {
  @apply flex items-center !py-0 !pl-1 text-sm hover:text-black;
}

.nc-workspace-dropdown-active-workspace-info {
  @apply flex text-xs text-gray-500;
  font-weight: 400;
  line-height: 1.125rem; /* 150% */
  letter-spacing: -0.015rem;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply hidden;
}
</style>
