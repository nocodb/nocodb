<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import { iconMap } from '~/utils/iconUtils'

const { t } = useI18n()

const allIcons = Object.keys(iconMap) as Array<keyof typeof iconMap>

const searchQuery = ref('')

// some icons hard-code white or dark fills — a fixed backdrop shows them in either theme
const TILE_BACKDROPS = {
  auto: { label: 'Theme', style: undefined },
  light: { label: 'Light', style: { background: '#ffffff', color: '#1f293a' } },
  dark: { label: 'Dark', style: { background: '#1f293a', color: '#e5e7eb' } },
} as const

const tileBackdrop = ref<keyof typeof TILE_BACKDROPS>('auto')

const filteredIcons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return allIcons
  return allIcons.filter((name) => name.toLowerCase().includes(query))
})

async function copyIconName(name: string) {
  try {
    await navigator.clipboard.writeText(name)
    message.success(t('msg.success.copiedValue', { value: `"${name}"` }))
  } catch {
    message.error(t('msg.error.copyToClipboardError'))
  }
}
</script>

<template>
  <PgPage title="Icons" description="Every icon registered in iconMap (utils/iconUtils.ts). Click an icon to copy its name.">
    <div class="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-nc-bg-default flex items-center gap-3">
      <a-input
        v-model:value="searchQuery"
        placeholder="Search icons"
        allow-clear
        class="nc-input-sm nc-input-shadow !max-w-80"
        data-testid="nc-playground-icon-search"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="w-4 h-4 text-nc-content-gray-muted" />
        </template>
      </a-input>
      <span class="text-captionSm text-nc-content-gray-muted">{{ filteredIcons.length }} of {{ allIcons.length }}</span>
      <div class="ml-auto flex items-center gap-1">
        <span class="text-captionSm text-nc-content-gray-muted mr-1">Tile</span>
        <button
          v-for="(b, key) in TILE_BACKDROPS"
          :key="key"
          class="h-7 px-3 rounded-md text-captionSm"
          :class="
            tileBackdrop === key
              ? 'bg-nc-bg-brand text-nc-content-brand'
              : 'text-nc-content-gray-subtle hover:bg-nc-bg-gray-light'
          "
          @click="tileBackdrop = key"
        >
          {{ b.label }}
        </button>
      </div>
    </div>

    <div v-if="!filteredIcons.length" class="py-16 text-center">
      <div class="text-captionBold text-nc-content-gray-subtle">No icons match "{{ searchQuery }}"</div>
      <div class="text-captionSm text-nc-content-gray-muted mt-1">Try a shorter or different keyword</div>
    </div>

    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1">
      <button
        v-for="name in filteredIcons"
        :key="name"
        class="group h-20 px-1.5 rounded-lg flex flex-col items-center justify-center gap-2 text-nc-content-gray hover:bg-nc-bg-gray-light hover:text-nc-content-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nc-border-brand"
        :title="name"
        @click="copyIconName(name)"
      >
        <span
          class="flex-none w-9 h-9 rounded-md flex items-center justify-center"
          :class="{ 'border-1 border-nc-border-gray-light': tileBackdrop !== 'auto' }"
          :style="TILE_BACKDROPS[tileBackdrop].style"
        >
          <component :is="iconMap[name]" class="w-5 h-5 flex-none" />
        </span>
        <span class="w-full text-captionXs font-mono text-nc-content-gray-muted group-hover:text-nc-content-brand truncate">
          {{ name }}
        </span>
      </button>
    </div>
  </PgPage>
</template>
