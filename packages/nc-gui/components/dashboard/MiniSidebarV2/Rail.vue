<script lang="ts" setup>
interface NavItem {
  key: string
  icon: string
  label: string
  accentColor?: string
  indicatorColor?: string
  onClick?: () => void
}

const emits = defineEmits<{
  (e: 'switch-panel', panel: string): void
}>()

const router = useRouter()

const route = router.currentRoute

const { navigateToProject, isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, activeWorkspace, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList, openedProject } = storeToRefs(basesStore)

const { isSharedBase } = storeToRefs(useBase())

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

const { toggleTheme, isThemeEnabled, selectedTheme } = useTheme()

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

const { isModalVisible: isChatVisible } = useChatWoot()

const toggleChatSupport = () => {
  if (!isChatVisible.value && !ncIsFunction(window.$chatwoot?.toggle)) {
    return
  }
  const toggleText = (isChatVisible.value ? 'hide' : 'show') as any
  window.$chatwoot.toggle(toggleText)
}

const activePanel = ref('agents')

const isBaseOpen = computed(() => {
  return route.value.name?.toString().startsWith('index-typeOrId-baseId-')
})

const isWsAdminRoute = computed(() => route.value.name === 'index-typeOrId-admin-page')

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

const onTabClick = (tabKey: string) => {
  activeSidebarTab.value = tabKey as any

  if (tabKey === 'admin') {
    // If a base is open, navigate to base admin; otherwise ws-level admin
    if (isBaseOpen.value) {
      navigateTo(`${getBasePath()}/admin`)
    } else {
      const wsId = route.value.params.typeOrId || activeWorkspaceId.value
      navigateTo(`/${wsId}/admin/ws-members`)
    }
    return
  }

  // Navigate to clean URL
  const basePath = getBasePath()
  if (!basePath) return

  if (tabKey === 'automation') {
    navigateTo(`${basePath}/automate`)
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

// ── Main nav items (add/remove/reorder here) ──
const mainItems: NavItem[] = [
  // {
  //   key: 'agents',
  //   icon: 'ncAgent',
  //   label: 'Agents',
  //   accentColor: '#d4944a',
  //   indicatorColor: '#c47830',
  //   onClick: () => {
  //     onTabClick('agents')
  //   },
  // },
  {
    key: 'data',
    icon: 'ncTable',
    label: 'Data',
    accentColor: '#7ba8f0',
    indicatorColor: '#5b8def',
    onClick: () => {
      onTabClick('data')
    },
  },
  {
    key: 'automation',
    icon: 'ncAutomation',
    label: 'Automation',
    accentColor: '#a78bfa',
    indicatorColor: '#8b5cf6',
    onClick: () => {
      onTabClick('automation')
    },
  },
]

// ── Bottom items (pushed down by margin-top: auto) ──
const bottomItems: NavItem[] = [
  { key: 'admin', icon: 'ncSettings', label: 'Admin', onClick: () => onTabClick('admin') },
  { key: 'support', icon: 'ncSupportAgent', label: 'Support', onClick: () => toggleChatSupport() },
]

const onItemClick = (panel: string) => {
  activePanel.value = panel
  emits('switch-panel', panel)
}
</script>

<template>
  <nav class="nc-rail" data-testid="nc-mini-sidebar-v2-rail">
    <!-- Logo -->
    <div class="nc-rail-logo" title="Home" data-testid="nc-mini-sidebar-v2-logo" @click="isBaseListModalOpen = true">
      <GeneralProjectIcon class="!h-7 !w-7" />
    </div>

    <div class="nc-rail-divider" />

    <!-- Main nav items -->
    <DashboardMiniSidebarV2RailItem
      v-for="item in mainItems"
      :key="item.key"
      :icon="item.icon"
      :label="item.label"
      :accent-color="item.accentColor"
      :indicator-color="item.indicatorColor"
      :panel-key="item.key"
      :active="activeSidebarTab === item.key"
      :disabled="!hasAvailableBases"
      :disable-tooltip="true"
      @click="item.onClick?.()"
    />

    <!-- Notifications -->
    <NcDropdown
      v-model:visible="isNotificationOpen"
      placement="right"
      overlay-class-name="!shadow-none"
      :overlay-style="{ marginLeft: '8px' }"
      :trigger="['click']"
    >
      <DashboardMiniSidebarV2RailItem
        label="Activity"
        tooltip="Activity"
        panel-key="notification"
        data-testid="nc-sidebar-notification-btn"
        :active="isNotificationOpen"
        :disable-tooltip="isNotificationOpen"
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

    <!-- Bottom group -->
    <div class="nc-rail-bottom-group">
      <!-- Theme toggle -->
      <DashboardMiniSidebarV2RailItem
        v-if="isThemeEnabled"
        :label="selectedTheme === 'light' ? 'Light' : selectedTheme === 'dark' ? 'Dark' : 'System'"
        :disable-tooltip="true"
        panel-key="theme"
        data-testid="nc-sidebar-theme"
        v-e="['c:nocodb:theme']"
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

    <div class="nc-rail-divider" />

    <DashboardMiniSidebarCreateNewActionMenu />

    <!-- User Avatar -->
    <DashboardSidebarUserInfo />

    <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
  </nav>
</template>

<style lang="scss" scoped>
.nc-rail {
  @apply flex flex-col gap-1.5 items-center h-full w-full pt-4 pt-1.5;
}

.nc-rail-logo {
  @apply flex items-center justify-center cursor-pointer pt-0.5 pb-1 opacity-90 hover:opacity-100 transform transition-all duration-150;

  color: #555;

  :root[theme='dark'] & {
    color: #9a9a9a;
  }

  &:hover {
    scale: 1.1;
  }
}

.nc-rail-divider {
  width: 28px;
  height: 1px;
  margin: 6px 0 4px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.12);

  :root[theme='dark'] & {
    background: #333;
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
