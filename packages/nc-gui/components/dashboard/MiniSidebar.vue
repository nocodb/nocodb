<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { appInfo, navigateToProject, isMobileMode } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const { commandPalette } = useCommandPalette()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened } = storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings, navigateToIntegrations: _navigateToIntegrations } = workspaceStore

const { basesList, showProjectList } = storeToRefs(useBases())

const { isUIAllowed } = useRoles()

const isProjectListOrHomePageOpen = computed(() => {
  return (
    route.value.name?.startsWith('index-typeOrId-baseId-') ||
    route.value.name === 'index' ||
    route.value.name === 'index-typeOrId'
  )
})

const isProjectPageOpen = computed(() => {
  return (
    (route.value.name?.startsWith('index-typeOrId-baseId-') ||
      route.value.name === 'index' ||
      route.value.name === 'index-typeOrId') &&
    showProjectList.value
  )
})

const navigateToProjectPage = () => {
  if (route.value.name?.startsWith('index-typeOrId-baseId-')) {
    showProjectList.value = !showProjectList.value

    return
  }

  navigateToProject({ workspaceId: activeWorkspaceId.value, baseId: basesList.value?.[0]?.id })
}

const navigateToSettings = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  // TODO: Handle cloud case properly
  navigateToWorkspaceSettings('', cmdOrCtrl)

  // if (appInfo.value.baseHostName) {
  //   window.location.href = `https://app.${appInfo.value.baseHostName}/dashboard`
  // } else {
  // }
}

const navigateToIntegrations = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  _navigateToIntegrations('', cmdOrCtrl)
}
</script>

<template>
  <div
    class="nc-mini-sidebar"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div class="flex flex-col gap-3 items-center">
      <WorkspaceMenu />

      <NcTooltip :title="$t('objects.projects')" placement="right" hide-on-click>
        <div
          class="nc-mini-sidebar-btn"
          data-testid="nc-sidebar-project-btn"
          :class="{
            active: isProjectPageOpen,
          }"
          @click="navigateToProjectPage"
        >
          <GeneralIcon :icon="isProjectListOrHomePageOpen ? 'ncBaseOutlineDuo' : 'ncBaseOutline'" class="h-4 w-4" />
        </div>
      </NcTooltip>
      <template v-if="!isMobileMode">
        <NcTooltip placement="right" hide-on-click>
          <template #title>
            <div class="flex items-center gap-1">
              <GeneralIcon icon="ncCommand" class="h-3" />
              K
            </div>
          </template>
          <div
            v-e="['c:quick-actions']"
            class="nc-mini-sidebar-btn"
            data-testid="nc-sidebar-cmd-k-btn"
            @click="commandPalette?.open()"
          >
            <GeneralIcon icon="search" class="h-4 w-4" />
          </div>
        </NcTooltip>
        <NcDivider class="!my-0 !border-nc-border-gray-dark" />
        <NcTooltip
          v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
          :title="$t('title.teamAndSettings')"
          placement="right"
          hide-on-click
        >
          <div
            v-e="['c:team:settings']"
            class="nc-mini-sidebar-btn"
            data-testid="nc-sidebar-team-settings-btn"
            :class="{
              active: isWorkspaceSettingsPageOpened,
            }"
            @click="navigateToSettings"
          >
            <GeneralIcon :icon="isWorkspaceSettingsPageOpened ? 'ncSettingsDuo' : 'ncSettings'" class="h-4 w-4" />
          </div>
        </NcTooltip>
        <NcTooltip v-if="isUIAllowed('workspaceSettings')" :title="$t('general.integrations')" placement="right" hide-on-click>
          <div
            v-e="['c:integrations']"
            class="nc-mini-sidebar-btn"
            data-testid="nc-sidebar-integrations-btn"
            :class="{
              active: isIntegrationsPageOpened,
            }"
            @click="navigateToIntegrations"
          >
            <GeneralIcon :icon="isIntegrationsPageOpened ? 'ncIntegrationDuo' : 'integration'" class="h-4 w-4" />
          </div>
        </NcTooltip>
        <NcDivider class="!my-0 !border-nc-border-gray-dark" />
        <NcTooltip v-if="appInfo.feedEnabled" :title="$t('title.whatsNew')" placement="right" hide-on-click>
          <DashboardSidebarFeed />
        </NcTooltip>
      </template>
    </div>
    <div class="flex flex-col gap-3 items-center">
      <NotificationMenu />

      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar {
  @apply w-[var(--mini-sidebar-width)] flex-none bg-nc-bg-gray-light flex flex-col justify-between items-center p-1.5 border-r-1 border-nc-border-gray-medium z-12;

  .nc-mini-sidebar-ws-item {
    @apply cursor-pointer h-9 w-8 rounded py-1 flex items-center justify-center children:flex-none text-nc-content-gray-muted transition-all duration-200;

    .nc-workspace-avatar {
      img {
        @apply !cursor-pointer;
      }
    }

    &.nc-small-shadow .nc-workspace-avatar {
      box-shadow: 0px 5px 0px -2px rgba(0, 0, 0, 0.4);
    }
    &.nc-medium-shadow .nc-workspace-avatar {
      box-shadow: 0px 4px 0px -2px rgba(0, 0, 0, 0.4), 0px 7px 0px -3px rgba(0, 0, 0, 0.2);
    }
  }

  .nc-mini-sidebar-btn {
    @apply cursor-pointer h-7 w-7 rounded !p-1.5 flex items-center justify-center children:flex-none !text-nc-content-gray-muted transition-all duration-200;

    &:not(.active) {
      @apply hover:bg-nc-bg-gray-medium;
    }

    &.active {
      @apply bg-nc-bg-gray-medium hover:bg-nc-bg-gray-medium !text-nc-content-gray;
    }
  }
}
</style>
