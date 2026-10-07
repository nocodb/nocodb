<script setup lang="ts">
import { PlaygroundTokenEditorOpenInj, playgroundNav } from './playground/-helper/registry'
import { usePlaygroundTokens } from './playground/-helper/tokens'
import TokenEditor from './playground/-components/TokenEditor.vue'

definePageMeta({
  hideHeader: true,
  middleware: [
    () => {
      const { user } = useGlobal()
      if (!canOpenPlayground(user.value?.email)) return navigateTo('/', { replace: true })
    },
  ],
})

const route = useRoute()

const { selectedTheme, clearColorCache, themeRepaintVersion } = useTheme()

const { overrideCount } = usePlaygroundTokens()

const { productName } = useBranding()

const { lastOpenedWorkspaceId } = useGlobal()

const isNarrow = useMediaQuery('(max-width: 819.98px)')

const isBelowXl = useMediaQuery('(max-width: 1279.98px)')

const isNavOpen = ref(!isNarrow.value)

const isTokenEditorOpen = ref(false)

provide(PlaygroundTokenEditorOpenInj, isTokenEditorOpen)

const appTheme = selectedTheme.value

const mainRef = ref<HTMLElement>()

const tokensToggleRef = ref<{ $el?: HTMLElement }>()

// only <main> scrolls; otherwise a demo dropdown near the bottom stretches the document
const isDocumentScrollLocked = useScrollLock(document.documentElement)

const themeOptions = [
  { value: 'light', label: 'Light', icon: 'ncSun' },
  { value: 'dark', label: 'Dark', icon: 'ncMoon' },
  { value: 'system', label: 'System', icon: 'ncMonitor' },
] as const

const navItems = playgroundNav.flatMap((s) => s.items)

const activeItem = computed(() => {
  // `expanded` redirects to the grid with `?rowId=`
  if (route.query.rowId && route.path.startsWith('/playground/views/grid')) {
    return navItems.find((item) => item.path === '/playground/views/expanded')
  }
  return navItems.find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`))
})

const pageName = computed(() => {
  if (activeItem.value) return activeItem.value.name
  return /^\/playground\/?$/.test(route.path) ? 'Overview' : 'Page not found'
})

const pageTitle = computed(() => `${pageName.value} | Playground`)

// "/" redirects with a push, leaving a dead history entry
const appHomePath = computed(() => (lastOpenedWorkspaceId.value ? `/${lastOpenedWorkspaceId.value}` : '/'))

useTitle(pageTitle, { restoreOnUnmount: (original) => original || productName.value })

// mounted views write their own tab title (store/views.ts updateTabTitle)
useMutationObserver(
  document.head,
  () => {
    if (document.title !== pageTitle.value) document.title = pageTitle.value
  },
  { childList: true, subtree: true, characterData: true },
)

// until then, demo autofocus on mount is undone instead of scrolled to
let settleUntil = 0

function settle() {
  settleUntil = Date.now() + 3000
  mainRef.value?.scrollTo({ top: 0 })
}

useEventListener(mainRef, 'focusin', (e: FocusEvent) => {
  if (Date.now() > settleUntil) return
  ;(e.target as HTMLElement).blur()
})

// some demos scrollIntoView after focusing; hold the top until the user takes over
useEventListener(mainRef, 'scroll', () => {
  if (Date.now() < settleUntil && mainRef.value?.scrollTop) mainRef.value.scrollTop = 0
})

for (const event of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
  useEventListener(window, event, () => (settleUntil = 0), { passive: true, capture: true })
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  const target = e.target as HTMLElement | null
  if (target?.closest('[role="combobox"][aria-expanded="true"], .ant-modal-wrap, .ant-dropdown, .ant-select-dropdown')) return
  if (document.querySelector('.ant-modal-wrap:not([style*="display: none"])')) return
  if (isNavOpen.value && isNarrow.value) {
    isNavOpen.value = false
    return
  }
  if (isTokenEditorOpen.value && (isNarrow.value || target?.closest('.nc-playground-token-editor'))) {
    isTokenEditorOpen.value = false
    tokensToggleRef.value?.$el?.focus()
  }
})

watch(
  () => route.path,
  () => {
    settle()
    if (isNarrow.value) isNavOpen.value = false
  },
)

watch(isNarrow, (narrow) => {
  isNavOpen.value = !narrow
})

watch(isTokenEditorOpen, (open) => {
  if (open && isBelowXl.value) isNavOpen.value = false
})

onMounted(() => {
  isDocumentScrollLocked.value = true
  settle()
})

onBeforeUnmount(() => {
  isDocumentScrollLocked.value = false
  document.getElementById('nc-playground-tokens')?.remove()
  selectedTheme.value = appTheme
  // the canvas grid cached the overridden token colours
  clearColorCache()
  themeRepaintVersion.value++
})
</script>

<template>
  <div class="nc-playground relative h-full w-full flex bg-nc-bg-default text-nc-content-gray overflow-hidden">
    <div v-if="isNavOpen && isNarrow" class="absolute inset-0 z-40 bg-black/40" @click="isNavOpen = false" />
    <aside
      v-if="isNavOpen"
      class="nc-playground-sidebar flex-none w-60 h-full flex flex-col border-r-1 border-nc-border-gray-medium bg-nc-bg-default select-none"
      :class="{ 'absolute inset-y-0 left-0 z-50 shadow-lg': isNarrow }"
    >
      <div class="flex-none h-14 px-2 flex items-center border-b-1 border-nc-border-gray-light">
        <NuxtLink
          to="/playground"
          class="!no-underline flex flex-1 items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-lg min-w-0 hover:bg-nc-bg-gray-medium transition-colors"
        >
          <div class="flex-none w-7 h-7 rounded-lg bg-nc-bg-brand flex items-center justify-center">
            <GeneralIcon icon="ncPalette" class="w-4 h-4 text-nc-content-brand" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="truncate text-sidebarDefault text-nc-content-gray-extreme">Playground</div>
            <div class="text-captionSm text-nc-content-gray-muted truncate">Design system</div>
          </div>
        </NuxtLink>
      </div>
      <nav class="flex-1 overflow-y-auto nc-scrollbar-thin pt-2 pb-3">
        <div v-for="section in playgroundNav" :key="section.title" class="mb-2">
          <div class="nc-pg-section-header">{{ section.title }}</div>
          <div class="px-2">
            <NuxtLink
              v-for="item in section.items"
              :key="item.path"
              :to="item.path"
              class="nc-pg-nav-link block !no-underline rounded-md focus-visible:outline-none focus-visible:shadow-selected"
            >
              <NcSidebarMenuItem :icon="item.icon" :active="activeItem?.path === item.path" class="!h-8 !my-0.5">
                {{ item.name }}
              </NcSidebarMenuItem>
            </NuxtLink>
          </div>
        </div>
      </nav>
      <div class="flex-none px-2 py-2 border-t-1 border-nc-border-gray-light">
        <NuxtLink
          :to="appHomePath"
          class="nc-pg-nav-link block !no-underline rounded-md focus-visible:outline-none focus-visible:shadow-selected"
          data-testid="nc-playground-back-to-app"
        >
          <NcSidebarMenuItem icon="ncArrowLeft" class="!h-8 !my-0">Back to app</NcSidebarMenuItem>
        </NuxtLink>
      </div>
    </aside>

    <div class="flex-1 min-w-0 h-full flex flex-col">
      <header class="flex-none h-14 px-3 flex items-center gap-2 border-b-1 border-nc-border-gray-light">
        <NcButton
          size="small"
          type="text"
          icon-only
          :aria-label="isNavOpen ? 'Hide navigation' : 'Show navigation'"
          :aria-expanded="isNavOpen"
          @click="isNavOpen = !isNavOpen"
        >
          <template #icon>
            <GeneralIcon icon="ncMenu" />
          </template>
        </NcButton>
        <div class="min-w-0 flex items-center gap-2">
          <span class="flex-none text-captionBold text-nc-content-gray-emphasis whitespace-nowrap">
            {{ pageName }}
          </span>
          <span v-if="activeItem" class="text-captionSm text-nc-content-gray-muted truncate hidden lg:inline">
            {{ activeItem.description }}
          </span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <div class="flex items-center p-0.5 rounded-lg bg-nc-bg-gray-light">
            <NcTooltip v-for="opt in themeOptions" :key="opt.value" :title="opt.label" placement="bottom" :arrow="false">
              <button
                class="w-7 h-6 rounded-md flex items-center justify-center text-nc-content-gray-muted"
                :class="{ 'bg-nc-bg-default shadow-sm !text-nc-content-gray-emphasis': selectedTheme === opt.value }"
                :aria-label="opt.label"
                :aria-pressed="selectedTheme === opt.value"
                @click="selectedTheme = opt.value"
              >
                <GeneralIcon :icon="opt.icon" class="w-3.5 h-3.5" />
              </button>
            </NcTooltip>
          </div>
          <NcButton
            ref="tokensToggleRef"
            size="small"
            :type="isTokenEditorOpen ? 'primary' : 'secondary'"
            :aria-pressed="isTokenEditorOpen"
            data-testid="nc-playground-tokens-toggle"
            @click="isTokenEditorOpen = !isTokenEditorOpen"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncSliders" />
              <span>Tokens</span>
              <span
                v-if="overrideCount"
                class="min-w-4 h-4 px-1 rounded-full bg-nc-bg-brand text-nc-content-brand text-captionXsBold flex items-center justify-center"
              >
                {{ overrideCount }}
              </span>
            </div>
          </NcButton>
        </div>
      </header>

      <div class="relative flex-1 min-h-0 flex">
        <main ref="mainRef" class="nc-playground-main flex-1 min-w-0 h-full overflow-auto nc-scrollbar-thin bg-nc-bg-default">
          <NuxtPage />
        </main>
        <TokenEditor
          v-if="isTokenEditorOpen"
          class="flex-none w-full max-w-[400px] h-full border-l-1 border-nc-border-gray-medium"
          :class="{ 'absolute inset-y-0 right-0 z-30 shadow-lg': isNarrow }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-pg-section-header {
  @apply pl-5 pr-2 pt-1.5 pb-1.5 font-semibold text-nc-content-gray-muted uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}
</style>
