<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { navigateToProject, isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, activeWorkspace, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList, openedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

const { selectedTheme } = useTheme()

const { isChatWootEnabled } = useProvideChatwoot()

const { isModalVisible: isChatVisible } = useChatWoot()

const toggleChatSupport = () => {
  if (!isChatVisible.value && !ncIsFunction(window.$chatwoot?.toggle)) {
    return
  }
  const toggleText = (isChatVisible.value ? 'hide' : 'show') as any
  window.$chatwoot.toggle(toggleText)
}

const isBaseOpen = computed(() => {
  return route.value.name?.toString().startsWith('index-typeOrId-baseId-')
})

const isWsAdminRoute = computed(() => route.value.name === 'index-typeOrId-settings-page')

// Resolve a base for icon display when not on a base route (e.g. ws-admin)
const resolvedProject = computed(() => {
  if (openedProject.value) return openedProject.value
  if (!isWsAdminRoute.value) return undefined

  const lastVisitedBaseId = ncLastVisitedBase().get()
  return basesList.value?.find((b) => b.id === lastVisitedBaseId) || basesList.value?.[0]
})

const baseIconColor = computed(() => {
  if (!resolvedProject.value) return undefined
  const meta = parseProp(resolvedProject.value.meta)
  return meta.iconColor
})

const showBaseIcon = computed(() => (isBaseOpen.value && openedProject.value) || (isWsAdminRoute.value && resolvedProject.value))

const isBaseListModalOpen = ref(false)

const miniSidebarTabs = computed(() => [
  { key: 'data' as const, icon: 'ncTableOutline', activeIcon: 'ncTableFilled', label: 'Data' },
  { key: 'automations' as const, icon: 'ncAutomation', activeIcon: 'ncAutomationsFilled', label: 'Automate' },
  // { key: 'agents' as const, icon: 'ncSupportAgent', activeIcon: 'ncSupportAgent', label: 'Agents' },
])

const { isUIAllowed } = useRoles()

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

const hasAvailableBases = computed(() => !!basesList.value?.length)

const getBasePath = () => {
  const wsId = route.value.params.typeOrId || activeWorkspaceId.value
  const baseId = route.value.params.baseId
  if (baseId) return `/${wsId}/${baseId}`

  // Resolve a base from last visited or first available
  const lastVisitedBaseId = ncLastVisitedBase().get()
  const resolvedBase = basesList.value?.find((b) => b.id === lastVisitedBaseId) || basesList.value?.[0]
  return resolvedBase?.id ? `/${wsId}/${resolvedBase.id}` : ''
}

const onTabClick = async (tabKey: string) => {
  if (tabKey === 'settings') {
    activeSidebarTab.value = 'settings'
    // If a base is open, navigate to base settings; otherwise ws-level settings
    if (isBaseOpen.value) {
      navigateTo(`${getBasePath()}/settings`)
    } else {
      const wsId = route.value.params.typeOrId || activeWorkspaceId.value
      navigateTo(`/${wsId}/settings/ws-members`)
    }
    return
  }

  // Navigate first, then update tab — avoids stale API calls from the current page
  const basePath = getBasePath()
  if (!basePath) return

  if (tabKey === 'automations') {
    await navigateTo(`${basePath}/automations`)
  } else {
    await navigateTo(basePath)
  }

  activeSidebarTab.value = tabKey as any
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
    <div class="flex flex-col items-center w-full">
      <!-- Base color icon at top-left -->
      <DashboardMiniSidebarItemWrapper v-if="showBaseIcon" size="small" show-in-mobile>
        <div
          class="h-[var(--topbar-height)] sticky top-0 bg-nc-bg-gray-minisidebar flex items-center justify-center cursor-pointer"
          @click="isBaseListModalOpen = true"
        >
          <div class="nc-stacked-base-icon">
            <GeneralProjectIcon :color="baseIconColor" class="h-5.5 w-5.5 relative z-1" />
          </div>
        </div>
      </DashboardMiniSidebarItemWrapper>

      <!-- Workspace selector (when no base open and not on ws-admin with resolved base) -->
      <DashboardMiniSidebarItemWrapper v-if="!showBaseIcon" size="small" show-in-mobile>
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
      <DashboardMiniSidebarItem
        v-for="tab in miniSidebarTabs"
        :key="tab.key"
        v-e="[`c:sidebar:minitab:${tab.key}`]"
        :icon="tab.icon"
        :active-icon="tab.activeIcon"
        :label="tab.label"
        :active="activeSidebarTab === tab.key"
        :disabled="!hasAvailableBases"
        :data-testid="`nc-mini-sidebar-tab-${tab.key}`"
        @click="onTabClick(tab.key)"
      />

      <!-- Notifications -->
      <DashboardMiniSidebarItem variant="item" label="Activity" tooltip="Activity">
        <NotificationMenu />
      </DashboardMiniSidebarItem>

      <!-- Divider -->
      <div class="w-8 border-t border-nc-border-gray-medium my-1"></div>

      <!-- Settings menu -->
      <DashboardMiniSidebarItem
        v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators') || isUIAllowed('workspaceIntegrations')"
        icon="ncSettings"
        label="Settings"
        :active="activeSidebarTab === 'settings' || isWorkspaceSettingsPageOpened || isIntegrationsPageOpened"
        data-testid="nc-sidebar-settings-btn"
        @click="onTabClick('settings')"
      />
    </div>
    <div class="flex flex-col items-center pb-1 w-full">
      <!-- Chat support -->
      <DashboardMiniSidebarItem
        v-if="isChatWootEnabled"
        v-e="['c:sidebar:chat-support']"
        icon="ncSupportAgent"
        label="Support"
        data-testid="nc-sidebar-chat-support-btn"
        @click="toggleChatSupport"
      />

      <!-- Theme toggle -->
      <DashboardMiniSidebarItem variant="item" :tooltip="`Appearance (beta): ${selectedTheme}`" hide-on-click-disabled>
        <DashboardMiniSidebarTheme />
      </DashboardMiniSidebarItem>

      <!-- Divider -->
      <div class="w-8 border-t border-nc-border-gray-medium my-1"></div>

      <DashboardSidebarUserInfo />
    </div>

    <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
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

  .nc-mini-sidebar-labeled-btn,
  .nc-mini-sidebar-labeled-item {
    @apply flex flex-col items-center justify-center gap-0.5 py-2 rounded-md cursor-pointer text-nc-content-gray-muted transition-all duration-150;
    width: calc(100% - 6px);
    margin-left: 3px;
    margin-right: 3px;
    min-height: 34px;

    @media (max-width: 1279px) {
      @apply py-2.5;
    }

    &:hover:not(.active):not(.disabled) {
      @apply bg-nc-bg-gray-medium text-nc-content-gray;
    }

    &.disabled {
      @apply opacity-40 cursor-not-allowed;
    }
  }

  .nc-mini-sidebar-labeled-btn {
    &.active {
      @apply !text-nc-content-brand;
    }
  }

  .nc-mini-sidebar-labeled-item {
    // Suppress inner button hover — outer container handles it
    .nc-mini-sidebar-btn-full-width {
      @apply !h-auto !w-auto !p-0;

      &:hover .nc-mini-sidebar-btn {
        @apply !bg-transparent;
      }
    }

    .nc-mini-sidebar-btn {
      @apply !h-auto !w-auto !p-0 !bg-transparent;

      &:hover,
      &.hovered {
        @apply !bg-transparent;
      }
    }

    .nc-button {
      @apply !h-auto !min-h-0 !p-0 !bg-transparent;

      &:hover,
      &.hovered {
        @apply !bg-transparent;
      }
    }
  }

  .nc-mini-sidebar-label {
    @apply text-[10px] leading-tight select-none;
    font-weight: 600;
    letter-spacing: 0.01em;

    @media (max-width: 1440px) {
      @apply !hidden;
    }
  }

  .nc-stacked-base-icon {
    @apply relative;

    &::before,
    &::after {
      content: '';
      @apply absolute rounded-sm;
      background: var(--nc-border-gray-medium);
    }

    &::before {
      @apply inset-x-0.75 -bottom-0.75;
      height: 4px;
      border-radius: 0 0 3px 3px;
    }

    &::after {
      @apply inset-x-1.5 -bottom-1.25;
      height: 3px;
      border-radius: 0 0 2px 2px;
      opacity: 0.6;
    }
  }
}
</style>
