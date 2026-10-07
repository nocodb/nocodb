<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import { iconMap } from '~/utils/iconUtils'

const allIcons = Object.keys(iconMap) as Array<keyof typeof iconMap>

const searchQuery = ref('')

const filteredIcons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return allIcons
  return allIcons.filter((name) => name.toLowerCase().includes(query))
})

async function copyIconName(name: string) {
  try {
    await navigator.clipboard.writeText(name)
    message.success(`Copied "${name}"`)
  } catch {
    message.error('Could not copy to clipboard')
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
        @click="copyIconName(name)"
      >
        <component :is="iconMap[name]" class="w-5 h-5 flex-none" />
        <span
          class="w-full text-captionXs font-mono text-nc-content-gray-muted group-hover:text-nc-content-brand line-clamp-2 break-all"
        >
          {{ name }}
        </span>
      </button>
    </div>
  </PgPage>
</template>
