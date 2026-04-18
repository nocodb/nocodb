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

const hasAvailableBases = computed(() => !!basesList.value?.length)

const getBasePath = () => {
  const wsId = route.value.params.typeOrId || activeWorkspaceId.value
  const baseId = route.value.params.baseId
  if (baseId) return `/${wsId}/${baseId}`

  const lastVisitedBaseId = ncLastVisitedBase().get()
  const resolvedBase = basesList.value?.find((b) => b.id === lastVisitedBaseId) || basesList.value?.[0]
  return resolvedBase?.id ? `/${wsId}/${resolvedBase.id}` : ''
}

const onTabClick = async (tabKey: string) => {
  if (isChatFullScreen.value) isChatFullScreen.value = false

  if (tabKey === 'settings') {
    activeSidebarTab.value = 'settings'
    if (isBaseOpen.value) {
      navigateTo(`${getBasePath()}/settings`)
    } else {
      const wsId = route.value.params.typeOrId || activeWorkspaceId.value
      navigateTo(`/${wsId}/members`)
    }
    return
  }

  const basePath = getBasePath()
  if (!basePath) return

  if (tabKey === 'workflows') {
    await navigateTo(`${basePath}/workflows`)
  } else {
    await navigateTo(basePath)
  }

  activeSidebarTab.value = tabKey as typeof activeSidebarTab.value
}

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

// ── Main nav items (same as Rail.vue) ──
const mainItems = computed<NavItem[]>(() => [
  {
    key: 'data',
    icon: 'ncTable',
    label: 'Data',
    disabled: !hasAvailableBases.value,
    onClick: () => onTabClick('data'),
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
          onClick: () => onTabClick('workflows'),
        },
      ]
    : []),
])

// ── Fish-eye magnification ──
const dockRef = ref<HTMLElement>()

const itemRefs = ref<Map<string, HTMLElement>>(new Map())

const itemScales = ref<Map<string, number>>(new Map())

const mouseY = ref<number | null>(null)

const isHovering = ref(false)

const MAG_RANGE = 100
const MAX_SCALE = 1.6
const MIN_SCALE = 1.0

const setItemRef = (key: string, el: any) => {
  if (!el) return

  let htmlEl = el?.$el ?? el
  if (htmlEl && !(htmlEl instanceof HTMLElement)) {
    htmlEl = htmlEl.nextElementSibling ?? htmlEl.parentElement
  }
  if (htmlEl instanceof HTMLElement) {
    itemRefs.value.set(key, htmlEl)
  }
}

const getScale = (key: string) => {
  return itemScales.value.get(key) ?? MIN_SCALE
}

const { isRtl } = useRtl()

const getMagnifyStyle = (key: string) => {
  const scale = getScale(key)
  const margin = ((scale - 1) * 48) / 2
  return {
    transform: `scale(${scale})`,
    transformOrigin: isRtl.value ? 'right center' : 'left center',
    marginTop: `${margin}px`,
    marginBottom: `${margin}px`,
  }
}

const calculateScales = () => {
  if (mouseY.value === null || !isHovering.value) {
    itemScales.value = new Map()
    return
  }

  const newScales = new Map<string, number>()

  itemRefs.value.forEach((el, key) => {
    if (!el || !ncIsFunction(el.getBoundingClientRect)) {
      newScales.set(key, MIN_SCALE)
      return
    }

    const rect = el.getBoundingClientRect()
    const itemCenterY = rect.top + rect.height / 2
    const dist = Math.abs(mouseY.value! - itemCenterY)

    // Quadratic falloff: t = max(0, 1 - dist²/range²)
    const t = Math.max(0, 1 - (dist * dist) / (MAG_RANGE * MAG_RANGE))
    const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * t
    newScales.set(key, scale)
  })

  itemScales.value = newScales
}

const onMouseMove = (e: MouseEvent) => {
  mouseY.value = e.clientY
  isHovering.value = true
  requestAnimationFrame(calculateScales)
}

const onMouseLeave = () => {
  mouseY.value = null
  isHovering.value = false
  calculateScales()
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
  if (!isEeUI || blockAiChat.value || !hasChatBaseContext.value) return
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
</script>

<template>
  <nav ref="dockRef" class="nc-dock" data-testid="nc-mini-sidebar-v2-dock" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <!-- Logo — hover shows back arrow, click navigates to workspace -->

    <DashboardMiniSidebarV2DockItem
      :ref="(el: any) => setItemRef('logo', el)"
      class="nc-dock-logo nc-dock-logo-hover"
      data-testid="nc-mini-sidebar-v2-logo"
      :data-workspace-title="activeWorkspace?.title"
      :label="`${$t('labels.backToWorkspace')} ${activeWorkspace?.title}`"
      :scale="getScale('logo')"
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
    </DashboardMiniSidebarV2DockItem>

    <NcDivider class="!w-8 !min-w-8 !mb-0 !border-nc-border-gray-medium !-mt-1.5" />

    <!-- Main nav items -->
    <DashboardMiniSidebarV2DockItem
      v-for="(item, idx) of mainItems"
      :key="idx"
      :ref="(el: any) => setItemRef(item.key, el)"
      :icon="item.icon"
      :label="item.label"
      :panel-key="item.key"
      :active="activeSidebarTab === item.key && !isChatFullScreen"
      :disabled="item.disabled"
      :scale="getScale(item.key)"
      @click="item.onClick?.()"
    />

    <!-- AI Chat -->
    <DashboardMiniSidebarV2DockItem
      v-if="isEeUI && !blockAiChat && hasChatWorkspaceContext && hasChatBaseContext && !isMobileMode"
      :ref="(el: any) => setItemRef('chat', el)"
      v-e="['c:chat:toggle']"
      label="Chat"
      panel-key="chat"
      data-testid="nc-sidebar-chat-btn"
      :active="isChatPanelExpanded"
      :scale="getScale('chat')"
      class="nc-dock-chat-item"
      @click="handleChatToggle"
    >
      <GeneralIcon icon="ncAutoAwesome" class="nc-dock-item-icon !text-nc-content-brand" />
    </DashboardMiniSidebarV2DockItem>

    <!-- Settings -->
    <DashboardMiniSidebarV2DockItem
      :ref="(el: any) => setItemRef('settings', el)"
      icon="ncSettings"
      label="Settings"
      panel-key="settings"
      :active="activeSidebarTab === 'settings' && !isChatFullScreen"
      :scale="getScale('settings')"
      @click="onTabClick('settings')"
    />

    <!-- Bottom group -->
    <div class="nc-dock-bottom-group" :class="{ 'is-hovering': isHovering }">
      <!-- Help -->
      <div :ref="(el: any) => setItemRef('help', el)" class="nc-dock-magnify-wrapper" :style="getMagnifyStyle('help')">
        <DashboardMiniSidebarHelp>
          <DashboardMiniSidebarV2DockItem icon="ncHelp" label="Help" panel-key="help" :scale="1" />
        </DashboardMiniSidebarHelp>
      </div>
    </div>

    <NcDivider class="!w-8 !min-w-8 !my-0 !border-nc-border-gray-medium" />

    <div
      v-if="!isMobileMode"
      :ref="(el: any) => setItemRef('create', el)"
      class="nc-dock-magnify-wrapper"
      :style="getMagnifyStyle('create')"
    >
      <DashboardMiniSidebarCreateNewActionMenu />
    </div>

    <!-- Activity / Notifications -->
    <NcDropdown
      v-if="!isMobileMode"
      v-model:visible="isNotificationOpen"
      :placement="isRtl ? 'left' : 'right'"
      overlay-class-name="!shadow-none"
      :overlay-style="isRtl ? { marginRight: '8px' } : { marginLeft: '8px' }"
      :trigger="['click']"
    >
      <div
        :ref="(el: any) => setItemRef('notification', el)"
        class="nc-dock-magnify-wrapper"
        :style="getMagnifyStyle('notification')"
      >
        <DashboardMiniSidebarV2DockItem
          :label="isNotificationOpen ? undefined : 'Activity'"
          panel-key="notification"
          data-testid="nc-sidebar-notification-btn"
          :active="isNotificationOpen"
          :scale="1"
        >
          <div class="relative flex items-center justify-center">
            <span
              v-if="unreadCount"
              class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full border border-white dark:border-[#1a1a1a]"
              style="background: #e75a8d"
            />
            <GeneralIcon icon="notification" class="nc-dock-item-icon" />
          </div>
        </DashboardMiniSidebarV2DockItem>
      </div>
      <template #overlay>
        <NotificationCard @close="isNotificationOpen = false" />
      </template>
    </NcDropdown>

    <!-- User Avatar -->
    <div :ref="(el: any) => setItemRef('user', el)" class="nc-dock-magnify-wrapper" :style="getMagnifyStyle('user')">
      <DashboardSidebarUserInfo />
    </div>

    <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
  </nav>
</template>

<style lang="scss" scoped>
.nc-dock {
  @apply flex flex-col items-center h-full w-full overflow-visible;
  gap: 6px;
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
}

.nc-dock-logo {
  @apply h-[var(--topbar-height)];

  opacity: 0.7;
  transform-origin: center center;
  color: #555;

  :root[theme='dark'] & {
    color: #9a9a9a;
  }

  &:hover {
    opacity: 1;
    background: none !important;
  }
}

.nc-dock-logo-hover {
  .nc-logo-icon,
  .nc-back-icon {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .nc-logo-icon {
    opacity: 1;
    transform: scale(1);
  }

  .nc-back-icon {
    @apply flex items-center justify-center;
    position: absolute;
    inset: 0;
    margin: auto;
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

.nc-dock-bottom-group {
  @apply flex flex-col items-center w-full;
  margin-top: auto;
}

.nc-dock-magnify-wrapper {
  @apply flex items-center justify-center flex-shrink-0;
  will-change: transform, margin;
  transition: transform 0.16s ease-out, margin 0.16s ease-out;
}

// Remove sticky background from UserInfo in dock context
:deep(.bg-nc-bg-gray-minisidebar) {
  background: transparent !important;
}
</style>
