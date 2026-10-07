<script setup lang="ts">
import { playgroundNav } from './playground/-helper/registry'
import { usePlaygroundTokens } from './playground/-helper/tokens'
import TokenEditor from './playground/-components/TokenEditor.vue'

definePageMeta({
  hideHeader: true,
})

const route = useRoute()

const { selectedTheme, setTheme } = useTheme()

const { overrideCount } = usePlaygroundTokens()

const isNavOpen = ref(true)

const isTokenEditorOpen = ref(false)

const mainRef = ref<HTMLElement>()

// only <main> scrolls; a dropdown a demo opens near the bottom would otherwise stretch the document
const isDocumentScrollLocked = useScrollLock(document.documentElement)

const themeOptions = [
  { value: 'light', icon: 'ncSun' },
  { value: 'dark', icon: 'ncMoon' },
  { value: 'system', icon: 'ncMonitor' },
] as const

const activeItem = computed(() =>
  playgroundNav.flatMap((s) => s.items).find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`)),
)

/** until then, autofocus from a demo mounting (NcList search, editing cells) is undone instead of scrolling to it */
let settleUntil = 0

function settle() {
  settleUntil = Date.now() + 3000
  // <main> outlives the pages, so it would keep the previous page's scroll offset
  mainRef.value?.scrollTo({ top: 0 })
}

useEventListener(mainRef, 'focusin', (e: FocusEvent) => {
  if (Date.now() > settleUntil) return
  ;(e.target as HTMLElement).blur()
})

// some demos also scrollIntoView after focusing; hold the top until the user takes over
useEventListener(mainRef, 'scroll', () => {
  if (Date.now() < settleUntil && mainRef.value?.scrollTop) mainRef.value.scrollTop = 0
})

for (const event of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
  useEventListener(mainRef, event, () => (settleUntil = 0), { passive: true })
}

watch(() => route.path, settle)

onMounted(() => {
  isDocumentScrollLocked.value = true
  settle()
})

onBeforeUnmount(() => {
  isDocumentScrollLocked.value = false
  document.getElementById('nc-playground-tokens')?.remove()
})
</script>

<template>
  <div class="nc-playground h-full w-full flex bg-nc-bg-default text-nc-content-gray overflow-hidden">
    <aside
      v-if="isNavOpen"
      class="nc-playground-sidebar flex-none w-60 h-full flex flex-col border-r-1 border-nc-border-gray-medium bg-nc-bg-default select-none"
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
            <NcSidebarMenuItem
              v-for="item in section.items"
              :key="item.path"
              :icon="item.icon"
              :active="activeItem?.path === item.path"
              class="!h-8 !my-0.5"
              @click="navigateTo(item.path)"
            >
              {{ item.name }}
            </NcSidebarMenuItem>
          </div>
        </div>
      </nav>
    </aside>

    <div class="flex-1 min-w-0 h-full flex flex-col">
      <header class="flex-none h-14 px-3 flex items-center gap-2 border-b-1 border-nc-border-gray-light">
        <NcButton size="small" type="text" icon-only @click="isNavOpen = !isNavOpen">
          <template #icon>
            <GeneralIcon icon="ncMenu" />
          </template>
        </NcButton>
        <div class="min-w-0 flex items-center gap-2">
          <span class="text-captionBold text-nc-content-gray-emphasis truncate">{{ activeItem?.name ?? 'Overview' }}</span>
          <span v-if="activeItem" class="text-captionSm text-nc-content-gray-muted truncate hidden md:inline">
            {{ activeItem.description }}
          </span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <div class="flex items-center p-0.5 rounded-lg bg-nc-bg-gray-light">
            <NcTooltip v-for="opt in themeOptions" :key="opt.value" :title="opt.value" :arrow="false">
              <button
                class="w-7 h-6 rounded-md flex items-center justify-center text-nc-content-gray-muted"
                :class="{ 'bg-nc-bg-default shadow-sm !text-nc-content-gray-emphasis': selectedTheme === opt.value }"
                @click="setTheme(opt.value)"
              >
                <GeneralIcon :icon="opt.icon" class="w-3.5 h-3.5" />
              </button>
            </NcTooltip>
          </div>
          <NcButton
            size="small"
            :type="isTokenEditorOpen ? 'primary' : 'secondary'"
            data-testid="nc-playground-tokens-toggle"
            @click="isTokenEditorOpen = !isTokenEditorOpen"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncSliders" />
              <span>Tokens</span>
              <span
                v-if="overrideCount"
                class="min-w-4 h-4 px-1 rounded-full bg-nc-fill-red-medium text-white text-captionXsBold flex items-center justify-center"
              >
                {{ overrideCount }}
              </span>
            </div>
          </NcButton>
        </div>
      </header>

      <div class="flex-1 min-h-0 flex">
        <main ref="mainRef" class="nc-playground-main flex-1 min-w-0 h-full overflow-auto nc-scrollbar-thin bg-nc-bg-default">
          <NuxtPage />
        </main>
        <TokenEditor v-if="isTokenEditorOpen" class="flex-none w-[400px] h-full border-l-1 border-nc-border-gray-medium" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* same as HomeSidebar's .nc-ws-section-header */
.nc-pg-section-header {
  @apply pl-5 pr-2 pt-1.5 pb-1.5 font-semibold text-nc-content-gray-muted uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}
</style>
