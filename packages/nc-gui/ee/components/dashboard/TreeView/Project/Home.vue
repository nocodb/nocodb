<script lang="ts" setup>
import Automation from '../Automation/index.vue'
import Data from '../Data/index.vue'

const router = useRouter()
const route = router.currentRoute

const sidebarStore = useSidebarStore()

const { isLeftSidebarOpen, activeSidebarTab } = storeToRefs(sidebarStore)

const { isSharedBase } = storeToRefs(useBase())
const { baseUrl, navigateToProjectPage: _navigateToBaseProjectPage } = useBase()

const workspaceStore = useWorkspace()

const { isTeamsEnabled } = storeToRefs(workspaceStore)
const workflowStore = useWorkflowStore()

const { openNewWorkflowModal } = workflowStore
const { openNewScriptModal } = useScriptStore()
const { openNewDashboardModal } = useDashboardStore()

const base = inject(ProjectInj)!

const baseRole = inject(ProjectRoleInj)!

const basesStore = useBases()

const { activeProjectId, basesList } = storeToRefs(basesStore)

const { meta: metaKey, control } = useMagicKeys()

const { isUIAllowed, baseRoles } = useRoles()

const { isMobileMode, appInfo } = useGlobal()

const { isDark } = useTheme()

const projectNodeRef = ref()

// If only base is open, i.e in case of docs, base view is open and not the page view
const baseViewOpen = computed(() => {
  const routeNameSplit = String(route.value?.name).split('baseId-index-index')
  if (routeNameSplit.length <= 1) return false

  const routeNameAfterProjectView = routeNameSplit[routeNameSplit.length - 1]
  return routeNameAfterProjectView.split('-').length === 2 || routeNameAfterProjectView.split('-').length === 1
})

const addNewProjectChildEntity = async (showSourceSelector = true) => {
  if (!projectNodeRef.value) return

  projectNodeRef.value?.addNewProjectChildEntity?.(showSourceSelector)
}

const openBaseHomePage = async () => {
  const isSharedBase = route.value.params.typeOrId === 'base'

  if (isMobileMode.value && isLeftSidebarOpen.value && route.value.name === 'index-typeOrId-baseId-index-index') {
    isLeftSidebarOpen.value = false

    return
  }

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  await navigateTo(
    `${cmdOrCtrl ? '#' : ''}${baseUrl({
      id: base.value.id!,
      type: 'database',
      isSharedBase,
      projectPage: !isUIAllowed('projectOverviewTab') || isMobileMode.value ? 'collaborator' : undefined,
    })}`,
    cmdOrCtrl
      ? {
          open: navigateToBlankTargetOpenOption,
        }
      : undefined,
  )

  if (isMobileMode.value && isLeftSidebarOpen.value) {
    isLeftSidebarOpen.value = false
  }
}

const isVisibleCreateNew = ref(false)

const hasTableCreatePermission = computed(() => {
  return isUIAllowed('tableCreate', {
    roles: baseRole.value,
    source: base.value?.sources?.[0],
  })
})

const resolveBaseId = () => {
  if (route.value.params.baseId) return route.value.params.baseId as string
  if (base.value?.id) return base.value.id

  const lastVisitedBaseId = ncLastVisitedBase().get()
  const resolved = basesList.value.find((b) => b.id === lastVisitedBaseId) || basesList.value[0]
  return resolved?.id
}

const navigateToBaseSettings = (page: string) => {
  const baseId = resolveBaseId()
  if (!baseId) return

  const wsId = route.value.params.typeOrId
  const slug = adminTabToSlug[page] || page
  navigateTo(`/${wsId}/${baseId}/settings/${slug}`)
}

const navigateToWsSettings = (page: string) => {
  const wsId = route.value.params.typeOrId
  const slug = adminTabToSlug[page] || page
  navigateTo(`/${wsId}/settings/${slug}`)
}

const activeAdminPage = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  return (route.value.params.page as string) || 'members'
})

const isAdminItemActive = (tab: string) => {
  const slug = adminTabToSlug[tab] || tab
  return activeAdminPage.value === slug
}

const isWsAdminItemActive = (tab: string) => {
  const slug = adminTabToSlug[tab] || tab
  return activeAdminPage.value === slug
}


</script>

<template>
  <div v-if="base?.id && !base.isLoading" class="nc-treeview-active-base">
    <div>
      <DashboardSidebarHeaderWrapper>
        <div v-if="isSharedBase" class="flex-1">
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
              <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/text.png" />
              <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
            </a>

            <div class="flex flex-grow"></div>
          </div>
        </div>

        <DashboardTreeViewProjectNode v-else ref="projectNodeRef" is-project-header />
      </DashboardSidebarHeaderWrapper>

      <div v-if="!isSharedBase && activeSidebarTab !== 'settings'" class="nc-project-home-section pt-1 !pb-2 flex flex-col gap-2">
        <div v-if="hasTableCreatePermission" class="flex items-center w-full xs:hidden">
          <NcDropdown v-model:visible="isVisibleCreateNew">
            <NcButton
              type="text"
              size="small"
              full-width
              class="nc-home-create-new-btn nc-home-create-new-dropdown-btn !text-nc-content-brand !hover:(text-nc-content-brand-disabled) !xs:hidden !w-full !px-3"
              :class="isVisibleCreateNew ? 'active' : ''"
              data-testid="nc-home-create-new-btn"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncPlusCircle" />

                <div>{{ $t('labels.createNew') }}</div>
              </div>
            </NcButton>

            <template #overlay>
              <DashboardTreeViewProjectCreateNewMenu
                v-model:visible="isVisibleCreateNew"
                @new-table="addNewProjectChildEntity()"
                @empty-script="openNewScriptModal({ baseId: base.id })"
                @empty-workflow="openNewWorkflowModal({ baseId: base.id })"
                @empty-dashboard="openNewDashboardModal({ baseId: base.id })"
              />
            </template>
          </NcDropdown>
        </div>
      </div>
    </div>
    <div class="flex-1 relative overflow-y-auto nc-scrollbar-thin">
      <!-- Data tab -->
      <template v-if="activeSidebarTab === 'data'">
        <Data :base-id="base.id" hide-header />
      </template>

      <!-- Automation/Workflows tab -->
      <template v-else-if="activeSidebarTab === 'automation'">
        <Automation v-if="!isSharedBase && !isMobileMode" :base-id="base.id" hide-header hide-create-button />
      </template>

      <!-- Agents tab: placeholder -->
      <template v-else-if="activeSidebarTab === 'agents'">
        <div class="flex items-center justify-center h-32 text-nc-content-gray-muted text-bodySm">
          {{ $t('general.comingSoon') }}
        </div>
      </template>

      <!-- Admin panel -->
      <template v-else-if="activeSidebarTab === 'settings'">
        <!-- Base Settings Section -->
        <div v-if="!isSharedBase" class="nc-project-home-section">
          <div class="nc-admin-section-header">
            {{ $t('labels.baseSettings') }}
          </div>
          <NcSidebarMenuItem
            v-if="isUIAllowed('newUser', { roles: baseRoles })"
            v-e="['c:admin:base:add-user']"
            icon="users"
            :active="isAdminItemActive('collaborator')"
            @click="navigateToBaseSettings('collaborator')"
          >
            {{ $t('labels.addUserToBase') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isEeUI && isUIAllowed('sourceCreate')"
            v-e="['c:admin:base:permissions']"
            icon="ncLock"
            :active="isAdminItemActive('permissions')"
            @click="navigateToBaseSettings('permissions')"
          >
            {{ $t('labels.dataPermissions') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isUIAllowed('manageMCP')"
            v-e="['c:admin:base:mcp']"
            icon="mcp"
            :active="isAdminItemActive('mcp')"
            @click="navigateToBaseSettings('mcp')"
          >
            {{ $t('title.mcpServer') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isEeUI && isUIAllowed('sourceCreate')"
            v-e="['c:admin:base:syncs']"
            icon="ncZap"
            :active="isAdminItemActive('syncs')"
            @click="navigateToBaseSettings('syncs')"
          >
            {{ $t('labels.manageSyncs') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isEeUI && isUIAllowed('baseMiscSettings') && isUIAllowed('manageSnapshot')"
            v-e="['c:admin:base:snapshots']"
            icon="camera"
            :active="isAdminItemActive('snapshots')"
            @click="navigateToBaseSettings('snapshots')"
          >
            {{ $t('labels.manageSnapshots') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isUIAllowed('sourceCreate')"
            v-e="['c:admin:base:add-data-source']"
            icon="ncDatabase"
            :active="isAdminItemActive('data-source')"
            @click="navigateToBaseSettings('data-source')"
          >
            {{ $t('labels.addDataSource') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-e="['c:admin:base:more']"
            icon="ncMoreHorizontal"
            :active="isAdminItemActive('base-settings')"
            @click="navigateToBaseSettings('base-settings')"
          >
            {{ $t('general.general') }}
          </NcSidebarMenuItem>
        </div>

        <div v-if="!isSharedBase" class="mx-3 border-t border-nc-border-gray-medium"></div>

        <!-- Workspace Settings Section -->
        <div class="nc-project-home-section">
          <div class="nc-admin-section-header">
            {{ $t('objects.workspace') }} {{ $t('labels.settings') }}
          </div>
          <NcSidebarMenuItem
            v-if="isUIAllowed('workspaceCollaborators')"
            v-e="['c:admin:ws:invite-user']"
            icon="users"
            :active="isWsAdminItemActive('ws-collaborators')"
            @click="navigateToWsSettings('ws-collaborators')"
          >
            {{ $t('labels.inviteUsersToWorkspace') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isEeUI && isTeamsEnabled"
            v-e="['c:admin:ws:add-team']"
            icon="ncBuilding"
            :active="isWsAdminItemActive('ws-teams')"
            @click="navigateToWsSettings('ws-teams')"
          >
            {{ $t('labels.manageTeams') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isUIAllowed('workspaceIntegrations')"
            v-e="['c:integrations']"
            icon="integration"
            :active="isWsAdminItemActive('ws-integrations')"
            @click="navigateToWsSettings('ws-integrations')"
          >
            {{ $t('general.integrations') }}
          </NcSidebarMenuItem>
          <NcSidebarMenuItem
            v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
            v-e="['c:admin:ws:general']"
            icon="ncMoreHorizontal"
            :active="isWsAdminItemActive('ws-settings')"
            @click="navigateToWsSettings('ws-settings')"
          >
            {{ $t('general.general') }}
          </NcSidebarMenuItem>
        </div>
      </template>
    </div>

    <slot name="footer"> </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-2 h-7 !xs:(pl-2 h-[3rem]) !pr-0.5 !py-0 hover:bg-nc-bg-gray-medium xs:(hover:bg-nc-bg-gray-extralight) !rounded-md;

  .ant-collapse-arrow {
    @apply !right-1 !xs:(flex-none border-1 border-nc-border-gray-medium w-6.5 h-6.5 mr-1);
  }
}

:deep(.ant-collapse-item) {
  @apply h-full;
}

:deep(.ant-collapse-header) {
  .nc-sidebar-upgrade-badge {
    @apply -mr-6;

    &.nc-sidebar-option-open {
      @apply mr-0.5;
    }
  }

  &:hover {
    .nc-sidebar-node-btn {
      &:not(.nc-sidebar-upgrade-badge) {
        @apply !opacity-100 !inline-block;
      }

      &.nc-sidebar-upgrade-badge {
        @apply mr-0.5;
      }

      &:not(.nc-sidebar-expand) {
        @apply !xs:hidden;
      }
    }
  }
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-0.25;
}

:deep(.nc-home-create-new-btn.nc-button) {
  &:not(.active) {
    @apply hover:bg-nc-bg-brand;
  }
}

.nc-admin-section-header {
  @apply px-3 pt-3 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}
</style>
