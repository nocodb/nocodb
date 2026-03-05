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

const { t } = useI18n()

const { $e } = useNuxtApp()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList, resolvedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

const { toggleTheme, isThemeEnabled, selectedTheme } = useTheme()

const { isUIAllowed, workspaceRoles } = useRoles()

const themeIcon = computed(
  () =>
    ({
      light: 'ncSun',
      dark: 'ncMoon',
      system: 'ncSunMoon',
    }[selectedTheme.value] as IconMapKey),
)

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const isNotificationOpen = ref(false)

const { isChatWootEnabled } = useProvideChatwoot()

const { blockAiChat } = useEeConfig()

const handleChatToggle = () => {
  toggleChatPanel()
}

const isBaseOpen = computed(() => {
  return route.value.name?.toString().startsWith('index-typeOrId-baseId-')
})

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
  ...(isEeUI && !isMobileMode.value
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
  { key: 'divider', icon: 'ncDivider', label: 'divider' },
  ...(!isMobileMode.value ? [{ key: 'notification', icon: 'ncNotification', label: 'Notification' }] : []),
  { key: 'settings', icon: 'ncSettings', label: 'Settings', onClick: () => onTabClick('settings') },
])

// ── Bottom items (pushed down by margin-top: auto) ──
const bottomItems = computed<NavItem[]>(
  () =>
    [
      isChatWootEnabled.value && !isMobileMode.value
        ? { key: 'support', icon: 'ncSupportAgent', label: 'Support', onClick: () => toggleChatSupport() }
        : null,
    ].filter(Boolean) as NavItem[],
)
</script>

<template>
  <nav class="nc-rail" data-testid="nc-mini-sidebar-v2-rail">
    <!-- Logo -->
    <div class="nc-rail-logo" title="Home" data-testid="nc-mini-sidebar-v2-logo" @click="isBaseListModalOpen = true">
      <GeneralProjectIcon
        class="!h-7 !w-7"
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
    </div>

    <NcDivider class="!w-8 !min-w-8 mt-1.5 mb-1 !border-nc-border-gray-medium" />

    <!-- Main nav items -->
    <template v-for="(item, idx) of mainItems">
      <NcDivider
        v-if="item.key === 'divider'"
        :key="`${item.key}-${idx}`"
        class="!w-8 !min-w-8 mt-1.5 mb-1 !border-nc-border-gray-medium"
      />

    <!-- AI Chat -->
    <DashboardMiniSidebarV2RailItem
      v-if="isEeUI && !blockAiChat && hasChatWorkspaceContext && !isMobileMode"
      v-e="['c:chat:toggle']"
      label="Chat"
      panel-key="chat"
      data-testid="nc-sidebar-chat-btn"
      :active="isChatPanelExpanded"
      :disable-tooltip="true"
      plain-active
      @click="handleChatToggle"
    >
      <template #icon>
        <GeneralIcon icon="ncAutoAwesome" class="nc-rail-item-icon !text-nc-content-brand" />
      </template>
    </DashboardMiniSidebarV2RailItem>

    <!-- Bottom group -->
    <div class="nc-rail-bottom-group">
      <!-- Theme toggle -->
      <DashboardMiniSidebarV2RailItem
        v-if="isThemeEnabled"
        v-e="['c:nocodb:theme']"
        :label="selectedTheme === 'light' ? 'Light' : selectedTheme === 'dark' ? 'Dark' : 'System'"
        :disable-tooltip="true"
        panel-key="theme"
        data-testid="nc-sidebar-theme"
        @click="toggleTheme"
      >
        <template #icon>
          <GeneralIcon :icon="themeIcon" class="nc-rail-item-icon" />
        </template>
      </DashboardMiniSidebarV2RailItem>

      <DashboardMiniSidebarV2RailItem
        v-for="item in bottomItems"
        :key="item.key"
        :icon="item.icon"
        :label="item.label"
        :panel-key="item.key"
        @click="item.onClick?.()"
      />
    </div>

    <NcDivider class="!w-8 !min-w-8 !max-w-8 pt-1.5 pb-1 !border-nc-border-gray-medium" />

    <DashboardMiniSidebarCreateNewActionMenu v-if="!isMobileMode" />

    <!-- User Avatar -->
    <DashboardSidebarUserInfo />

    <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
  </nav>
</template>

<style lang="scss" scoped>
.nc-rail {
  @apply flex flex-col gap-1.5 items-center h-full w-full pt-1.5;
}

.nc-rail-logo {
  @apply flex items-center justify-center cursor-pointer pt-1 opacity-90 hover:opacity-100 transform transition-all duration-150;

  &:hover {
    scale: 1.1;
  }
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
</style>
