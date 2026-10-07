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

const themeOptions = [
  { value: 'light', icon: 'ncSun' },
  { value: 'dark', icon: 'ncMoon' },
  { value: 'system', icon: 'ncMonitor' },
] as const

const activeItem = computed(() =>
  playgroundNav.flatMap((s) => s.items).find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`)),
)

onBeforeUnmount(() => {
  document.getElementById('nc-playground-tokens')?.remove()
})
</script>

<template>
  <div class="nc-playground nc-h-screen w-screen flex bg-nc-bg-default text-nc-content-gray overflow-hidden">
    <aside
      v-if="isNavOpen"
      class="flex-none w-60 h-full flex flex-col border-r-1 border-nc-border-gray-medium bg-[var(--color-sidebar-bg)]"
    >
      <NuxtLink to="/playground" class="!no-underline flex items-center gap-2 px-4 h-12 border-b-1 border-nc-border-gray-medium">
        <GeneralIcon icon="ncPalette" class="w-4 h-4 text-nc-content-brand" />
        <span class="text-captionBold text-nc-content-gray-emphasis">Playground</span>
        <NcBadge color="purple" :border="false" class="!h-5 ml-auto text-nc-content-purple-dark text-captionXsBold">DEV</NcBadge>
      </NuxtLink>
      <nav class="flex-1 overflow-y-auto nc-scrollbar-thin py-2">
        <div v-for="section in playgroundNav" :key="section.title" class="mb-3">
          <div class="px-4 py-1 text-captionXsBold uppercase tracking-wide text-nc-content-gray-muted">
            {{ section.title }}
          </div>
          <NuxtLink
            v-for="item in section.items"
            :key="item.path"
            :to="item.path"
            class="!no-underline mx-2 px-2 h-8 rounded-md flex items-center gap-2 text-captionDropdownDefault text-nc-content-gray-subtle hover:bg-nc-bg-gray-light"
            :class="{ '!bg-nc-bg-brand !text-nc-content-brand': activeItem?.path === item.path }"
          >
            <GeneralIcon :icon="item.icon" class="w-4 h-4 flex-none" />
            <span class="truncate">{{ item.name }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>

    <div class="flex-1 min-w-0 h-full flex flex-col">
      <header class="flex-none h-12 px-3 flex items-center gap-2 border-b-1 border-nc-border-gray-medium">
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
        <main class="nc-playground-main flex-1 min-w-0 h-full overflow-auto nc-scrollbar-thin bg-nc-bg-default">
          <NuxtPage />
        </main>
        <TokenEditor v-if="isTokenEditorOpen" class="flex-none w-96 h-full border-l-1 border-nc-border-gray-medium" />
      </div>
    </div>
  </div>
</template>
