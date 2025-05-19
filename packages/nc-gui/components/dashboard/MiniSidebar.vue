<script lang="ts" setup>
import { nextTick } from 'vue'
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { appInfo, navigateToProject, isMobileMode } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const { commandPalette } = useCommandPalette()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

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

  navigateToProject({ workspaceId: isEeUI ? activeWorkspaceId.value : undefined, baseId: basesList.value?.[0]?.id })
}

const navigateToSettings = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  navigateToWorkspaceSettings('', cmdOrCtrl)
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
        isDrawerOrModalExist() ||
        isExpandedFormOpenExist()))
  ) {
    return
  }

  switch (e.code) {
    case 'KeyB': {
      e.preventDefault()
      showProjectList.value = true
      await nextTick()
      document
        .querySelector<HTMLInputElement>('.nc-base-search-input input')
        ?.focus()
      break
    }
  }
})
</script>

<template>
  <div class="nc-mini-sidebar" data-testid="nc-mini-sidebar">
    <div class="flex flex-col gap-3 items-center">
      <DashboardSidebarMiniSidebarItemWrapper size="small">
        <div
          class="min-h-9"
          :class="{
            'pt-1.5 pb-2.5': isMobileMode,
          }"
        >
          <GeneralLoader v-if="isWorkspacesLoading" size="large" />
          <WorkspaceMenu v-else />
        </div>
      </DashboardSidebarMiniSidebarItemWrapper>

      <DashboardSidebarMiniSidebarItemWrapper>
        <NcTooltip placement="right" hide-on-click :arrow="false">
          <template #title>
            <div class="flex gap-1.5">
              {{ $t('objects.projects') }}
              <div class="px-1 text-bodySmBold text-white bg-gray-700 rounded">{{ renderAltOrOptlKey(true) }} B</div>
            </div>
          </template>
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
      </DashboardSidebarMiniSidebarItemWrapper>

      <template v-if="!isMobileMode">
        <DashboardSidebarMiniSidebarItemWrapper>
          <NcTooltip placement="right" hide-on-click :arrow="false">
            <template #title>
              <div class="flex items-center gap-1">{{ renderCmdOrCtrlKey(true) }} K</div>
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
        </DashboardSidebarMiniSidebarItemWrapper>
        <NcDivider v-if="isUIAllowed('workspaceSettings')" class="!my-0 !border-nc-border-gray-dark" />
        <DashboardSidebarMiniSidebarItemWrapper v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')">
          <NcTooltip :title="$t('title.teamAndSettings')" placement="right" hide-on-click :arrow="false">
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
        </DashboardSidebarMiniSidebarItemWrapper>
        <DashboardSidebarMiniSidebarItemWrapper v-if="isUIAllowed('workspaceSettings')">
          <NcTooltip :title="$t('general.integrations')" placement="right" hide-on-click :arrow="false">
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
        </DashboardSidebarMiniSidebarItemWrapper>
        <NcDivider class="!my-0 !border-nc-border-gray-dark" />
        <DashboardSidebarMiniSidebarItemWrapper>
          <NcTooltip v-if="appInfo.feedEnabled" :title="$t('title.whatsNew')" placement="right" hide-on-click :arrow="false">
            <DashboardSidebarFeed />
          </NcTooltip>
        </DashboardSidebarMiniSidebarItemWrapper>
      </template>
    </div>
    <div class="flex flex-col gap-3 items-center">
      <DashboardSidebarMiniSidebarItemWrapper v-if="appInfo.feedEnabled">
        <NcTooltip :title="$t('general.notification')" placement="right" hide-on-click :arrow="false">
          <NotificationMenu />
        </NcTooltip>
      </DashboardSidebarMiniSidebarItemWrapper>

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
