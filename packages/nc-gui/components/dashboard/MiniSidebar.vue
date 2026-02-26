<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { navigateToProject, isMobileMode, appInfo } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const workspaceStore = useWorkspace()

const {
  activeWorkspaceId,
  activeWorkspace,
  isWorkspaceSettingsPageOpened,
  isIntegrationsPageOpened,
  isWorkspacesLoading,
  isTemplatesPageOpened,
} = storeToRefs(workspaceStore)

const {
  navigateToWorkspaceSettings,
  navigateToIntegrations: _navigateToIntegrations,
  navigateToTemplates: _navigateToTemplates,
  isTemplatesFeatureEnabled,
} = workspaceStore

const basesStore = useBases()

const { basesList, openedProject } = storeToRefs(basesStore)

const { isSharedBase } = storeToRefs(useBase())

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

const isBaseOpen = computed(() => {
  return route.value.name?.toString().startsWith('index-typeOrId-baseId-')
})

const baseIconColor = computed(() => {
  if (!openedProject.value) return undefined
  const meta = parseProp(openedProject.value.meta)
  return meta.iconColor
})

const miniSidebarTabs = computed(() => [
  { key: 'data' as const, icon: 'table', activeIcon: 'ncTableFilled', label: 'Data' },
  { key: 'automation' as const, icon: 'ncAutomation', activeIcon: 'ncAutomationsFilled', label: 'Workflows' },
  { key: 'agents' as const, icon: 'ncSupportAgent', activeIcon: 'ncSupportAgent', label: 'Agents' },
])

const { isUIAllowed } = useRoles()

const { setActiveCmdView } = useCommand()

const { isChatWootEnabled } = useProvideChatwoot()

const navigateToProjectPage = () => {
  if (route.value.name?.startsWith('index-typeOrId-baseId-')) {
    return
  }

  const lastVisitedBase = ncLastVisitedBase().get()

  const baseToNavigate = lastVisitedBase
    ? basesList.value?.find((b) => b.id === lastVisitedBase) ?? basesList.value[0]
    : basesList.value[0]

  navigateToProject({ workspaceId: isEeUI ? activeWorkspaceId.value : undefined, baseId: baseToNavigate?.id })
}

const navigateToSettings = () => {
  if (isEeUI && !appInfo.value?.ee && !appInfo.value?.isOnPrem) {
    navigateTo('/account/users/list')
    return
  }

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  navigateToWorkspaceSettings('', cmdOrCtrl)
}

const navigateToTemplates = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  _navigateToTemplates('', cmdOrCtrl)
}

const navigateToIntegrations = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  _navigateToIntegrations('', cmdOrCtrl)
}

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const isBaseSearchInput = e.target instanceof HTMLInputElement && e.target.closest('.nc-base-search-input')

  if (
    !e.altKey ||
    (!isBaseSearchInput &&
      (isActiveInputElementExist(e) ||
        cmdKActive() ||
        isCmdJActive() ||
        isNcDropdownOpen() ||
        isActiveElementInsideExtension() ||
        isActiveElementInsideScriptPane() ||
        isDrawerOrModalExist() ||
        isExpandedFormOpenExist()))
  ) {
    return
  }

  switch (e.code) {
    case 'KeyB': {
      e.preventDefault()
      navigateToProjectPage()
      break
    }
  }
})
</script>

<template>
  <div class="nc-mini-sidebar" data-testid="nc-mini-sidebar">
    <div class="flex flex-col items-center">
      <!-- Base color icon at top-left -->
      <DashboardMiniSidebarItemWrapper v-if="isBaseOpen && openedProject" size="small" show-in-mobile>
        <div class="h-[var(--topbar-height)] sticky top-0 bg-nc-bg-gray-minisidebar flex items-center justify-center">
          <GeneralProjectIcon
            :color="baseIconColor"
            class="h-5.5 w-5.5"
          />
        </div>
      </DashboardMiniSidebarItemWrapper>

      <!-- Workspace selector (when no base open) -->
      <DashboardMiniSidebarItemWrapper v-if="!isBaseOpen" size="small" show-in-mobile>
        <div
          class="min-h-9 sticky top-0 bg-nc-bg-gray-minisidebar"
          :class="{
            'pt-1.5 pb-1': isMobileMode,
          }"
        >
          <GeneralLoader v-if="isWorkspacesLoading" size="large" />
          <NcTooltip v-else placement="right" hide-on-click :arrow="false" :disabled="!activeWorkspace">
            <template #title>
              <div class="capitalize">{{ activeWorkspace?.title ?? '' }}</div>
            </template>
            <WorkspaceMenu />
          </NcTooltip>
        </div>
      </DashboardMiniSidebarItemWrapper>

      <!-- Data / Workflows / Agents tabs -->
      <template v-if="isBaseOpen">
        <DashboardMiniSidebarItemWrapper v-for="tab in miniSidebarTabs" :key="tab.key">
          <NcTooltip :title="tab.label" placement="right" hide-on-click :arrow="false">
            <div
              v-e="[`c:sidebar:minitab:${tab.key}`]"
              class="nc-mini-sidebar-btn-full-width"
              :data-testid="`nc-mini-sidebar-tab-${tab.key}`"
              @click="activeSidebarTab = tab.key"
            >
              <div
                class="nc-mini-sidebar-btn"
                :class="{
                  active: activeSidebarTab === tab.key,
                }"
              >
                <GeneralIcon
                  :icon="activeSidebarTab === tab.key ? tab.activeIcon : tab.icon"
                  class="h-4 w-4"
                />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
      </template>

    </div>
    <div class="flex flex-col items-center">
      <DashboardMiniSidebarItemWrapper
        v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
        :show-in-mobile="isEeUI"
      >
        <NcTooltip
          :title="isEeUI ? `${$t('objects.workspace')} ${$t('labels.settings')}` : $t('title.teamAndSettings')"
          placement="right"
          hide-on-click
          :arrow="false"
        >
          <div
            v-e="['c:team:settings']"
            class="nc-mini-sidebar-btn-full-width"
            data-testid="nc-sidebar-team-settings-btn"
            @click="navigateToSettings"
          >
            <div
              class="nc-mini-sidebar-btn"
              :class="{
                active: isWorkspaceSettingsPageOpened,
              }"
            >
              <GeneralIcon icon="ncSettings" class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <DashboardMiniSidebarItemWrapper v-if="isUIAllowed('workspaceIntegrations')">
        <NcTooltip
          :title="isEeUI ? `${$t('objects.workspace')} ${$t('general.integrations')}` : $t('general.integrations')"
          placement="right"
          hide-on-click
          :arrow="false"
        >
          <div
            v-e="['c:integrations']"
            class="nc-mini-sidebar-btn-full-width"
            data-testid="nc-sidebar-integrations-btn"
            @click="navigateToIntegrations"
          >
            <div
              class="nc-mini-sidebar-btn"
              :class="{
                active: isIntegrationsPageOpened,
              }"
            >
              <GeneralIcon icon="integration" class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>

      <DashboardMiniSidebarItemWrapper>
        <NcTooltip :title="$t('labels.myNotifications')" placement="right" hide-on-click :arrow="false">
          <NotificationMenu />
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>

      <template v-if="!isMobileMode">
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip v-if="!isSharedBase" :title="$t('labels.createNew')" placement="right" hide-on-click :arrow="false">
            <DashboardMiniSidebarCreateNewActionMenu />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
      </template>

      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar {
  @apply w-[var(--mini-sidebar-width)] flex-none bg-nc-bg-gray-minisidebar flex flex-col justify-between items-center border-r-1 border-nc-border-gray-medium z-502 nc-scrollbar-thin overflow-x-hidden relative;

  .nc-mini-sidebar-ws-item {
    @apply cursor-pointer h-9 w-8 rounded py-1 flex items-center justify-center children:flex-none text-nc-content-gray-muted transition-all duration-200;

    .nc-workspace-avatar {
      img {
        @apply !cursor-pointer;
      }
    }

    &.nc-small-shadow .nc-workspace-avatar {
      box-shadow: 0px 5px 0px -2px rgba(var(--rgb-base), 0.4);
    }
    &.nc-medium-shadow .nc-workspace-avatar {
      box-shadow: 0px 4px 0px -2px rgba(var(--rgb-base), 0.4), 0px 7px 0px -3px rgba(var(--rgb-base), 0.2);
    }
  }

  .nc-mini-sidebar-btn-full-width {
    @apply w-[var(--mini-sidebar-width)] h-[var(--mini-sidebar-width)] flex-none flex justify-center items-center cursor-pointer transition-all duration-200;

    &:hover {
      .nc-mini-sidebar-btn:not(.active) {
        @apply bg-nc-bg-gray-medium;
      }
    }
  }

  .nc-mini-sidebar-btn {
    @apply cursor-pointer h-7 w-7 rounded !p-1.5 flex items-center justify-center children:flex-none !text-nc-content-gray-muted transition-all duration-200;

    &:not(.active) {
      @apply hover:bg-nc-bg-gray-medium;
    }

    &.active {
      @apply !bg-nc-brand-100 dark:!bg-nc-bg-gray-medium !text-nc-content-brand;
    }

    &.active-base {
      @apply !text-nc-content-brand;
    }

    &.hovered {
      @apply bg-nc-bg-gray-medium;
    }
  }
}
</style>
