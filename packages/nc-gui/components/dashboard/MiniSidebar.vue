<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { appInfo, navigateToProject, isMobileMode } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings, navigateToIntegrations: _navigateToIntegrations } = workspaceStore

const { basesList, showProjectList } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { isUIAllowed } = useRoles()

const { setActiveCmdView } = useCommand()

const { isChatWootEnabled } = useProvideChatwoot()

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

  const lastVisitedBase = ncLastVisitedBase().get()

  const baseToNavigate = lastVisitedBase
    ? basesList.value?.find((b) => b.id === lastVisitedBase) ?? basesList.value[0]
    : basesList.value[0]

  navigateToProject({ workspaceId: isEeUI ? activeWorkspaceId.value : undefined, baseId: baseToNavigate?.id })
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
      navigateToProjectPage()
      break
    }
  }
})
</script>

<template>
  <div class="nc-mini-sidebar" data-testid="nc-mini-sidebar">
    <div class="flex flex-col items-center">
      <DashboardMiniSidebarItemWrapper size="small" show-in-mobile>
        <div
          class="min-h-9 sticky top-0 bg-[var(--mini-sidebar-bg-color)]"
          :class="{
            'pt-1.5 pb-1': isMobileMode,
          }"
        >
          <GeneralLoader v-if="isWorkspacesLoading" size="large" />
          <WorkspaceMenu v-else />
        </div>
      </DashboardMiniSidebarItemWrapper>

      <DashboardMiniSidebarItemWrapper show-in-mobile>
        <NcTooltip placement="right" hide-on-click :arrow="false">
          <template #title>
            <div class="flex gap-1.5">
              {{ $t('labels.baseList') }}
              <div class="px-1 text-bodySmBold text-white bg-gray-700 rounded">{{ renderAltOrOptlKey(true) }} B</div>
            </div>
          </template>
          <div class="nc-mini-sidebar-btn-full-width" data-testid="nc-sidebar-project-btn" @click="navigateToProjectPage">
            <div
              class="nc-mini-sidebar-btn"
              :class="{
                'active': isProjectPageOpen,
                'active-base': isProjectListOrHomePageOpen,
              }"
            >
              <GeneralIcon icon="ncBaseOutline" class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <div v-if="!isMobileMode" class="px-2 w-full">
        <NcDivider class="!border-nc-border-gray-dark !my-1" />
      </div>

      <DashboardMiniSidebarItemWrapper>
        <NcTooltip placement="right" hide-on-click :arrow="false">
          <template #title>
            <div class="flex items-center gap-1">{{ $t('labels.quickSearch') }} {{ renderCmdOrCtrlKey(true) }} K</div>
          </template>
          <div
            v-e="['c:quick-actions']"
            class="nc-mini-sidebar-btn-full-width"
            data-testid="nc-sidebar-cmd-k-btn"
            @click="setActiveCmdView('cmd-k')"
          >
            <div class="nc-mini-sidebar-btn">
              <GeneralIcon icon="search" class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <DashboardMiniSidebarItemWrapper>
        <NcTooltip placement="right" hide-on-click :arrow="false">
          <template #title>
            <div class="flex items-center gap-1">{{ $t('labels.recentViews') }} {{ renderCmdOrCtrlKey(true) }} L</div>
          </template>
          <div
            v-e="['c:quick-actions']"
            class="nc-mini-sidebar-btn-full-width"
            data-testid="nc-sidebar-cmd-l-btn"
            @click="setActiveCmdView('cmd-l')"
          >
            <div class="nc-mini-sidebar-btn">
              <MdiClockOutline class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <DashboardMiniSidebarItemWrapper>
        <NcTooltip placement="right" hide-on-click :arrow="false">
          <template #title>
            <div class="flex items-center gap-1">{{ $t('labels.searchDocumentation') }} {{ renderCmdOrCtrlKey(true) }} J</div>
          </template>
          <div
            v-e="['c:quick-actions']"
            class="nc-mini-sidebar-btn-full-width"
            data-testid="nc-sidebar-cmd-j-btn"
            @click="setActiveCmdView('cmd-j')"
          >
            <div class="nc-mini-sidebar-btn">
              <GeneralIcon icon="ncFile" class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <div
        v-if="(!isMobileMode || isEeUI) && (isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators'))"
        class="px-2 my-2 w-full"
      >
        <NcDivider class="!my-0 !border-nc-border-gray-dark" />
      </div>
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

      <div v-if="!isMobileMode" class="px-2 w-full">
        <NcDivider class="!my-0 !border-nc-border-gray-dark !my-2" />
      </div>
      <DashboardMiniSidebarItemWrapper>
        <NcTooltip :title="$t('labels.myNotifications')" placement="right" hide-on-click :arrow="false">
          <NotificationMenu />
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
    </div>
    <div class="flex flex-col items-center">
      <DashboardMiniSidebarItemWrapper>
        <DashboardMiniSidebarTheme />
      </DashboardMiniSidebarItemWrapper>

      <DashboardMiniSidebarItemWrapper>
        <NcTooltip :title="$t('general.help')" placement="right" hide-on-click :arrow="false">
          <DashboardMiniSidebarHelp />
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <template v-if="!isMobileMode">
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip
            v-if="appInfo.feedEnabled"
            :title="`${$t('title.whatsNew')}!`"
            placement="right"
            hide-on-click
            :arrow="false"
          >
            <DashboardSidebarFeed />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <DashboardMiniSidebarItemWrapper v-if="isChatWootEnabled">
          <NcTooltip :title="`${$t('labels.chatWithNocoDBSupport')}!`" placement="right" hide-on-click :arrow="false">
            <DashboardSidebarChatSupport />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <div class="px-2 w-full">
          <NcDivider class="!my-2 !border-nc-border-gray-dark" />
        </div>
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip v-if="!isSharedBase" :title="$t('labels.createNew')" placement="right" hide-on-click :arrow="false">
            <DashboardMiniSidebarCreateNewActionMenu />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
      </template>
      <div v-else class="px-2 w-full">
        <NcDivider class="!my-2 !border-nc-border-gray-dark" />
      </div>

      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar {
  --mini-sidebar-bg-color: var(--nc-bg-gray-light);

  @apply w-[var(--mini-sidebar-width)] flex-none bg-[var(--mini-sidebar-bg-color)] flex flex-col justify-between items-center border-r-1 border-nc-border-gray-medium z-502 nc-scrollbar-thin overflow-x-hidden relative;

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

  .nc-mini-sidebar-btn-full-width {
    @apply w-[var(--mini-sidebar-width)] h-[var(--mini-sidebar-width)] flex-none flex justify-center items-center cursor-pointer;

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
      @apply !bg-nc-brand-100 !text-nc-content-brand;
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
