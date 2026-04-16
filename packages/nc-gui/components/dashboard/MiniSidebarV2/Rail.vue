<script lang="ts" setup>
import { extractBaseRoleFromWorkspaceRole } from 'nocodb-sdk'

interface NavItem {
  key: string
  icon: string
  label: string
  disabled?: boolean
  onClick?: () => void
}

const router = useRouter()

const route = router.currentRoute

const { navigateToProject, isMobileMode } = useGlobal()

const { $e: _$e } = useNuxtApp()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, activeWorkspace } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList, resolvedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

const { isUIAllowed, workspaceRoles } = useRoles()

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const isNotificationOpen = ref(false)

const {
  isPanelExpanded: isChatPanelExpanded,
  isFullScreen: isChatFullScreen,
  hasWorkspaceContext: hasChatWorkspaceContext,
  hasBaseContext: hasChatBaseContext,
  toggleChatPanel,
} = useChatPanel()

const { blockAiChat, showEEFeatures } = useEeConfig()

const { isRtl } = useRtl()

const handleChatToggle = () => {
  toggleChatPanel()
}

const isBaseOpen = computed(() => {
  return route.value.name?.toString().startsWith('index-typeOrId-baseId-')
})

watch(
  isBaseOpen,
  (val) => {
    if (val && ncBackRoute().get() !== '/') ncBackRoute().set('')
  },
  { immediate: true },
)

const isBaseListModalOpen = ref(false)

const navigateToProjectPage = () => {
  if (route.value.name?.toString().startsWith('index-typeOrId-baseId-')) {
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

  return resolvedProject.value?.id ? `/${wsId}/${resolvedProject.value.id}` : ''
}

const onTabClick = async (tabKey: string) => {
  if (isChatFullScreen.value) isChatFullScreen.value = false

  if (tabKey === 'settings') {
    activeSidebarTab.value = 'settings'
    // If a base is open, navigate to base settings; otherwise ws-level settings
    if (isBaseOpen.value) {
      navigateTo(`${getBasePath()}/settings`)
    } else {
      const wsId = route.value.params.typeOrId || activeWorkspaceId.value
      navigateTo(`/${wsId}/members`)
    }
    return
  }

  // Navigate first, then update tab — avoids stale API calls from the current page
  const basePath = getBasePath()
  if (!basePath) return

  if (tabKey === 'workflows') {
    await navigateTo(`${basePath}/workflows`)
  } else {
    await navigateTo(basePath)
  }

  activeSidebarTab.value = tabKey as typeof activeSidebarTab.value
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

// Cmd/Ctrl + Shift + A — toggle AI chat
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (!isEeUI || blockAiChat.value) return
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (
    cmdOrCtrl &&
    e.shiftKey &&
    e.code === 'KeyA' &&
    !isActiveInputElementExist(e) &&
    !isNcDropdownOpen() &&
    !isDrawerOrModalExist()
  ) {
    e.preventDefault()
    handleChatToggle()
  }
})

// ── Main nav items (add/remove/reorder here) ──
const mainItems = computed<NavItem[]>(() => [
  {
    key: 'data',
    icon: 'ncTable',
    label: 'Data',
    disabled: !hasAvailableBases.value,
    onClick: () => {
      onTabClick('data')
    },
  },
  ...(isEeUI && !isMobileMode.value && showEEFeatures.value
    ? [
        {
          key: 'workflows',
          icon: 'ncAutomation',
          label: 'Workflows',
          disabled:
            !hasAvailableBases.value ||
            !isUIAllowed('scriptList', {
              roles: resolvedProject.value?.project_role || extractBaseRoleFromWorkspaceRole(workspaceRoles.value),
            }),
          onClick: () => {
            onTabClick('workflows')
          },
        },
      ]
    : []),
])
</script>

<template>
  <nav class="nc-rail" data-testid="nc-mini-sidebar-v2-rail">
    <div class="flex-none h-[var(--topbar-height)] w-full relative flex items-center justify-center">
      <!-- Logo — hover shows back arrow, click navigates to workspace -->
      <NcTooltip placement="right" :arrow="false">
        <template #title>{{ $t('labels.backToWorkspace') }}: {{ activeWorkspace?.title }}</template>
        <div
          class="nc-rail-logo nc-rail-logo-hover"
          data-testid="nc-mini-sidebar-v2-logo"
          :data-workspace-title="activeWorkspace?.title"
          @click="navigateTo(`/${activeWorkspaceId}`)"
        >
          <GeneralProjectIcon
            class="!h-7 !w-7 nc-logo-icon"
            :color="parseProp(resolvedProject?.meta).iconColor"
            :type="resolvedProject?.type"
            :managed-app="
              resolvedProject
                ? {
                    managed_app_master: resolvedProject?.managed_app_master,
                    managed_app_id: resolvedProject?.managed_app_id,
                  }
                : undefined
            "
          />
          <div class="nc-back-icon">
            <GeneralIcon icon="ncArrowLeft" class="!h-4.5 !w-4.5 text-nc-content-gray" />
          </div>
        </div>
      </NcTooltip>
      <div class="absolute bottom-0 left-0 right-0 flex justify-center">
        <NcDivider class="!w-8 !min-w-8 !my-0 !border-nc-border-gray-medium" />
      </div>
    </div>

    <!-- Main nav items -->
    <DashboardMiniSidebarV2RailItem
      v-for="(item, idx) of mainItems"
      :key="idx"
      :icon="item.icon"
      :label="item.label"
      :panel-key="item.key"
      :active="activeSidebarTab === item.key && !isChatFullScreen"
      :disabled="item.disabled"
      :disable-tooltip="true"
      @click="item.onClick?.()"
    />

    <!-- AI Chat -->
    <DashboardMiniSidebarV2RailItem
      v-if="isEeUI && !blockAiChat && hasChatWorkspaceContext && hasChatBaseContext && !isMobileMode"
      v-e="['c:chat:toggle']"
      label="Chat"
      panel-key="chat"
      data-testid="nc-sidebar-chat-btn"
      :active="isChatPanelExpanded"
      :disable-tooltip="true"
      :plain-active="!isChatFullScreen"
      @click="handleChatToggle"
    >
      <template #icon>
        <GeneralIcon icon="ncAutoAwesome" class="nc-rail-item-icon !text-nc-content-brand" />
      </template>
    </DashboardMiniSidebarV2RailItem>

    <!-- Settings -->
    <DashboardMiniSidebarV2RailItem
      icon="ncSettings"
      label="Settings"
      panel-key="settings"
      :active="activeSidebarTab === 'settings' && !isChatFullScreen"
      :disable-tooltip="true"
      @click="onTabClick('settings')"
    />

    <!-- Bottom group -->
    <div class="nc-rail-bottom-group">
      <!-- Help -->
      <DashboardMiniSidebarHelp>
        <DashboardMiniSidebarV2RailItem icon="ncHelp" label="Help" panel-key="help" is-dropdown />
      </DashboardMiniSidebarHelp>
    </div>

    <NcDivider class="!w-8 !min-w-8 !max-w-8 !my-0 !border-nc-border-gray-medium" />

    <DashboardMiniSidebarCreateNewActionMenu v-if="!isMobileMode" />

    <!-- Activity / Notifications -->
    <NcDropdown
      v-model:visible="isNotificationOpen"
      :placement="isRtl ? 'left' : 'right'"
      overlay-class-name="!shadow-none"
      :overlay-style="isRtl ? { marginRight: '8px' } : { marginLeft: '8px' }"
      :trigger="['click']"
    >
      <DashboardMiniSidebarV2RailItem
        label="Activity"
        tooltip="Activity"
        panel-key="notification"
        data-testid="nc-sidebar-notification-btn"
        :active="isNotificationOpen"
        :disable-tooltip="isNotificationOpen"
        is-dropdown
      >
        <template #icon>
          <div class="relative flex items-center justify-center">
            <span
              v-if="unreadCount"
              class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full border border-white dark:border-[#1a1a1a]"
              style="background: #e75a8d"
            />
            <GeneralIcon icon="notification" class="nc-rail-item-icon" />
          </div>
        </template>
      </DashboardMiniSidebarV2RailItem>
      <template #overlay>
        <NotificationCard @close="isNotificationOpen = false" />
      </template>
    </NcDropdown>

    <!-- User Avatar -->
    <DashboardSidebarUserInfo />

    <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
  </nav>
</template>

<style lang="scss" scoped>
.nc-rail {
  @apply flex flex-col gap-1.5 items-center h-full w-full;
}

.nc-rail-logo {
  @apply flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 transition-all duration-150 p-1.5 rounded-lg;
}

.nc-rail-bottom-group {
  @apply flex flex-col items-center w-full;
  margin-top: auto;
}

.nc-rail-admin-wrapper {
  @apply relative w-full flex justify-center;

  .nc-notif-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    background: #e75a8d;
    border-radius: 50%;
    border: 2px solid #f0f0f0;
    z-index: 1;

    :root[theme='dark'] & {
      border-color: #161616;
    }
  }
}

.nc-rail-logo-hover {
  @apply relative;
  // Fixed size so layout never shifts
  width: 40px;
  height: 40px;

  .nc-logo-icon,
  .nc-back-icon {
    @apply absolute inset-0 m-auto;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .nc-logo-icon {
    opacity: 1;
    transform: scale(1);
  }

  .nc-back-icon {
    @apply flex items-center justify-center;
    opacity: 0;
    transform: scale(0.8);
  }

  &:hover {
    .nc-logo-icon {
      opacity: 0;
      transform: scale(0.8);
    }
    .nc-back-icon {
      opacity: 1;
      transform: scale(1);
    }
  }
}
</style>
