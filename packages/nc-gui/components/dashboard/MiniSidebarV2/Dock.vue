<script lang="ts" setup>
interface NavItem {
  key: string
  icon: string
  label: string
  accentColor?: string
  indicatorColor?: string
  disabled?: boolean
  onClick?: () => void
}

const router = useRouter()

const route = router.currentRoute

const { navigateToProject } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList } = storeToRefs(basesStore)

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

useProvideChatwoot()

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
  if (tabKey === 'settings') {
    activeSidebarTab.value = 'settings'
    if (isBaseOpen.value) {
      navigateTo(`${getBasePath()}/settings`)
    } else {
      const wsId = route.value.params.typeOrId || activeWorkspaceId.value
      navigateTo(`/${wsId}/settings/ws-members`)
    }
    return
  }

  const basePath = getBasePath()
  if (!basePath) return

  if (tabKey === 'automation') {
    await navigateTo(`${basePath}/automation`)
  } else {
    await navigateTo(basePath)
  }

  activeSidebarTab.value = tabKey as any
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
    accentColor: '#7ba8f0',
    indicatorColor: '#5b8def',
    disabled: !hasAvailableBases.value,
    onClick: () => onTabClick('data'),
  },
  {
    key: 'automation',
    icon: 'ncAutomation',
    label: 'Automation',
    accentColor: '#a78bfa',
    indicatorColor: '#8b5cf6',
    disabled: !hasAvailableBases.value,
    onClick: () => onTabClick('automation'),
  },
  { key: 'divider', icon: '', label: '' },
  { key: 'settings', icon: 'ncSettings', label: 'Settings', onClick: () => onTabClick('settings') },
])

// ── Bottom items ──
const bottomItems = computed<NavItem[]>(() => [
  { key: 'support', icon: 'ncSupportAgent', label: 'Support', onClick: () => toggleChatSupport() },
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

const getMagnifyStyle = (key: string) => {
  const scale = getScale(key)
  const margin = ((scale - 1) * 48) / 2
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'left center',
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
</script>

<template>
  <nav
    ref="dockRef"
    class="nc-dock"
    data-testid="nc-mini-sidebar-v2-dock"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Logo -->
    <DashboardMiniSidebarV2DockItem
      :ref="(el: any) => setItemRef('logo', el)"
      class="nc-dock-logo"
      label="Home"
      data-testid="nc-mini-sidebar-v2-logo"
      :scale="getScale('logo')"
      @click="isBaseListModalOpen = true"
    >
      <GeneralProjectIcon class="!h-7 !w-7" />
    </DashboardMiniSidebarV2DockItem>

    <div class="nc-dock-separator" />

    <!-- Main nav items -->
    <template v-for="(item, idx) of mainItems">
      <div v-if="item.key === 'divider'" :key="`${item.key}-${idx}`" class="nc-dock-separator" />

      <DashboardMiniSidebarV2DockItem
        v-else
        :key="idx"
        :ref="(el: any) => setItemRef(item.key, el)"
        :icon="item.icon"
        :label="item.label"
        :accent-color="item.accentColor"
        :indicator-color="item.indicatorColor"
        :panel-key="item.key"
        :active="activeSidebarTab === item.key"
        :disabled="item.disabled"
        :scale="getScale(item.key)"
        @click="item.onClick?.()"
      />
    </template>

    <!-- Notifications -->
    <NcDropdown
      v-model:visible="isNotificationOpen"
      placement="right"
      overlay-class-name="!shadow-none"
      :overlay-style="{ marginLeft: '8px' }"
      :trigger="['click']"
    >
      <DashboardMiniSidebarV2DockItem
        :ref="(el: any) => setItemRef('notification', el)"
        :label="isNotificationOpen ? undefined : 'Activity'"
        panel-key="notification"
        data-testid="nc-sidebar-notification-btn"
        :active="isNotificationOpen"
        :scale="getScale('notification')"
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
      <template #overlay>
        <NotificationCard @close="isNotificationOpen = false" />
      </template>
    </NcDropdown>

    <!-- Bottom group -->
    <div class="nc-dock-bottom-group" :class="{ 'is-hovering': isHovering }">
      <!-- Theme toggle -->
      <DashboardMiniSidebarV2DockItem
        v-if="isThemeEnabled"
        :ref="(el: any) => setItemRef('theme', el)"
        :label="selectedTheme === 'light' ? 'Light' : selectedTheme === 'dark' ? 'Dark' : 'System'"
        panel-key="theme"
        data-testid="nc-sidebar-theme"
        :scale="getScale('theme')"
        v-e="['c:nocodb:theme']"
        @click="toggleTheme"
      >
        <GeneralIcon :icon="themeIcon" class="nc-dock-item-icon" />
      </DashboardMiniSidebarV2DockItem>

      <DashboardMiniSidebarV2DockItem
        v-for="item in bottomItems"
        :key="item.key"
        :ref="(el: any) => setItemRef(item.key, el)"
        :icon="item.icon"
        :label="item.label"
        :panel-key="item.key"
        :scale="getScale(item.key)"
        @click="item.onClick?.()"
      />
    </div>

    <div class="nc-dock-separator" />

    <div
      :ref="(el: any) => setItemRef('create', el)"
      class="nc-dock-magnify-wrapper"
      :style="getMagnifyStyle('create')"
    >
      <DashboardMiniSidebarCreateNewActionMenu />
    </div>

    <!-- User Avatar -->
    <div
      :ref="(el: any) => setItemRef('user', el)"
      class="nc-dock-magnify-wrapper"
      :style="getMagnifyStyle('user')"
    >
      <DashboardSidebarUserInfo />
    </div>

    <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
  </nav>
</template>

<style lang="scss" scoped>
.nc-dock {
  @apply flex flex-col items-center h-full w-full overflow-visible;
  padding: 14px 0;
  gap: 6px;
  background: rgba(240, 240, 240, 0.92);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border-right: 1px solid rgba(0, 0, 0, 0.08);

  :root[theme='dark'] & {
    background: rgba(22, 22, 22, 0.88);
    border-right-color: rgba(255, 255, 255, 0.08);
  }
}

.nc-dock-logo {
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

.nc-dock-separator {
  width: 32px;
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
  margin: 4px 0;
  flex-shrink: 0;
  align-self: center;

  :root[theme='dark'] & {
    background: rgba(255, 255, 255, 0.1);
  }
}

.nc-dock-bottom-group {
  @apply flex flex-col items-center w-full;
  margin-top: auto;
  transition: margin-top 0.25s ease;

  &.is-hovering {
    margin-top: 0;
  }
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
