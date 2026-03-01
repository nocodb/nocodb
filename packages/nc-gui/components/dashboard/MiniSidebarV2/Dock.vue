<script lang="ts" setup>
interface NavItem {
  key: string
  icon: string
  label: string
  accentColor?: string
  indicatorColor?: string
}

const emits = defineEmits<{
  (e: 'switch-panel', panel: string): void
}>()

const activePanel = ref('agents')

// ── Main nav items (add/remove/reorder here) ──
const mainItems: NavItem[] = [
  { key: 'agents', icon: 'ncZap', label: 'Agents', accentColor: '#d4944a', indicatorColor: '#c47830' },
  { key: 'data', icon: 'ncTableOutline', label: 'Data', accentColor: '#7ba8f0', indicatorColor: '#5b8def' },
  { key: 'workflows', icon: 'ncAutomation', label: 'Workflows', accentColor: '#a78bfa', indicatorColor: '#8b5cf6' },
  { key: 'wiki', icon: 'ncFile', label: 'Wiki', accentColor: '#5dd9ab', indicatorColor: '#10b981' },
]

// ── Bottom items (pushed down by margin-top: auto) ──
const bottomItems: NavItem[] = [
  { key: 'bookmarks', icon: 'ncBookmark', label: 'Bookmarks' },
  { key: 'more', icon: 'ncMoreHorizontal', label: 'More' },
]

const onItemClick = (panel: string) => {
  activePanel.value = panel
  emits('switch-panel', panel)
}

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
</script>

<template>
  <nav
    ref="dockRef"
    class="nc-dock"
    data-testid="nc-mini-sidebar-v2-dock"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Logo (uses dock-item dimensions: 48×48, matching reference .dock-item.dock-logo) -->
    <DashboardMiniSidebarV2DockItem class="nc-dock-logo" label="Home" data-testid="nc-mini-sidebar-v2-logo">
      <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="6" fill="none" />
        <circle cx="50" cy="50" r="38" stroke="currentColor" stroke-width="2" fill="none" />
        <line x1="50" y1="50" x2="50" y2="8" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <line x1="50" y1="50" x2="86.4" y2="71" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <line x1="50" y1="50" x2="13.6" y2="71" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
      </svg>
    </DashboardMiniSidebarV2DockItem>

    <div class="nc-dock-separator" />

    <!-- Main nav items -->
    <DashboardMiniSidebarV2DockItem
      v-for="item in mainItems"
      :key="item.key"
      :ref="(el: any) => setItemRef(item.key, el)"
      :icon="item.icon"
      :label="item.label"
      :accent-color="item.accentColor"
      :indicator-color="item.indicatorColor"
      :panel-key="item.key"
      :active="activePanel === item.key"
      :scale="getScale(item.key)"
      @click="onItemClick(item.key)"
    />

    <!-- Bottom group -->
    <div class="nc-dock-bottom-group">
      <DashboardMiniSidebarV2DockItem
        v-for="item in bottomItems"
        :key="item.key"
        :ref="(el: any) => setItemRef(item.key, el)"
        :icon="item.icon"
        :label="item.label"
        :panel-key="item.key"
        :scale="getScale(item.key)"
      />
    </div>

    <div class="nc-dock-separator" />

    <!-- Settings with notification dot -->
    <div class="nc-dock-admin-wrapper">
      <DashboardMiniSidebarV2DockItem
        :ref="(el: any) => setItemRef('settings', el)"
        icon="ncSettings"
        label="Settings"
        panel-key="settings"
        :active="activePanel === 'settings'"
        :scale="getScale('settings')"
        @click="onItemClick('settings')"
      />
      <span class="nc-notif-dot" />
    </div>

    <!-- User Avatar -->
    <DashboardMiniSidebarV2UserMenu />
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
}

.nc-dock-admin-wrapper {
  @apply relative flex justify-center;

  .nc-notif-dot {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    background: #e75a8d;
    border-radius: 50%;
    border: 2px solid transparent;
    z-index: 1;
  }
}
</style>
