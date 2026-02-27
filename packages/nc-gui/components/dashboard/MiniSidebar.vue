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
} = storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList, openedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

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

const baseIconColor = computed(() => {
  if (!openedProject.value) return undefined
  const meta = parseProp(openedProject.value.meta)
  return meta.iconColor
})

const isBaseListModalOpen = ref(false)

const miniSidebarTabs = computed(() => [
  { key: 'data' as const, icon: 'table', activeIcon: 'ncTableFilled', label: 'Data' },
  { key: 'automation' as const, icon: 'ncAutomation', activeIcon: 'ncAutomationsFilled', label: 'Automate' },
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

const getBasePath = () => {
  const wsId = route.value.params.typeOrId
  const baseId = route.value.params.baseId
  return `/${wsId}/${baseId}`
}

const onTabClick = (tabKey: string) => {
  activeSidebarTab.value = tabKey as any

  // Navigate to clean URL
  const basePath = getBasePath()
  if (tabKey === 'automation') {
    navigateTo(`${basePath}/automate`)
  } else if (tabKey === 'admin') {
    navigateTo(`${basePath}/admin`)
  } else {
    navigateTo(basePath)
  }
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
        <div
          class="h-[var(--topbar-height)] sticky top-0 bg-nc-bg-gray-minisidebar flex items-center justify-center cursor-pointer"
          @click="isBaseListModalOpen = true"
        >
          <div class="nc-stacked-base-icon">
            <GeneralProjectIcon
              :color="baseIconColor"
              class="h-5.5 w-5.5 relative z-1"
            />
          </div>
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
        <div
          v-for="tab in miniSidebarTabs"
          :key="tab.key"
          v-e="[`c:sidebar:minitab:${tab.key}`]"
          class="nc-mini-sidebar-labeled-btn"
          :class="{ active: activeSidebarTab === tab.key }"
          :data-testid="`nc-mini-sidebar-tab-${tab.key}`"
          @click="onTabClick(tab.key)"
        >
          <GeneralIcon
            :icon="activeSidebarTab === tab.key ? tab.activeIcon : tab.icon"
            class="h-4.5 w-4.5"
          />
          <span class="nc-mini-sidebar-label">{{ tab.label }}</span>
        </div>
      </template>

      <!-- Notifications (below agents) -->
      <div class="nc-mini-sidebar-labeled-item">
        <NotificationMenu />
        <span class="nc-mini-sidebar-label">Activity</span>
      </div>

      <!-- Divider -->
      <div class="w-8 border-t border-nc-border-gray-medium my-1"></div>

      <!-- Admin menu -->
      <div
        v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators') || isUIAllowed('workspaceIntegrations')"
        class="nc-mini-sidebar-labeled-btn"
        :class="{ active: activeSidebarTab === 'admin' || isWorkspaceSettingsPageOpened || isIntegrationsPageOpened }"
        data-testid="nc-sidebar-admin-btn"
        @click="onTabClick('admin')"
      >
        <GeneralIcon icon="ncSettings" class="h-4.5 w-4.5" />
        <span class="nc-mini-sidebar-label">Admin</span>
      </div>

    </div>
    <div class="flex flex-col items-center pb-1">
      <!-- Chat support -->
      <div
        v-if="isChatWootEnabled"
        v-e="['c:sidebar:chat-support']"
        class="nc-mini-sidebar-labeled-btn"
        data-testid="nc-sidebar-chat-support-btn"
        @click="toggleChatSupport"
      >
        <GeneralIcon icon="ncSupportAgent" class="h-4.5 w-4.5" />
        <span class="nc-mini-sidebar-label">Support</span>
      </div>

      <!-- Theme toggle (Light / Dark / System) -->
      <div class="nc-mini-sidebar-labeled-item">
        <DashboardMiniSidebarTheme />
        <span class="nc-mini-sidebar-label">Mode</span>
      </div>

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
    @apply flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md cursor-pointer text-nc-content-gray-muted transition-all duration-150;
    width: calc(100% - 6px);
    margin-left: 3px;
    margin-right: 3px;

    &:hover:not(.active) {
      @apply bg-nc-bg-gray-medium text-nc-content-gray;
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

      &:hover:not(.hovered) {
        @apply !bg-transparent;
      }
    }

    .nc-button {
      @apply !h-auto !min-h-0 !p-0 !bg-transparent;

      &:hover:not(.hovered) {
        @apply !bg-transparent;
      }
    }
  }

  .nc-mini-sidebar-label {
    @apply text-[10px] leading-tight select-none;
    font-weight: 600;
    letter-spacing: 0.01em;
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
