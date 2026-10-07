<script setup lang="ts">
/** Page frame for a playground page: heading, optional TOC built from `sections`. */
defineProps<{
  title: string
  description?: string
  sections?: Array<{ id: string; title: string }>
}>()

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="flex min-h-full">
    <div class="flex-1 min-w-0 px-8 py-6">
      <div class="max-w-6xl mx-auto">
        <div class="mb-6">
          <h1 class="text-heading3 text-nc-content-gray-emphasis">{{ title }}</h1>
          <p v-if="description" class="text-body text-nc-content-gray-subtle mt-1 max-w-3xl">{{ description }}</p>
        </div>
        <slot />
      </div>
    </div>
    <nav v-if="sections?.length" class="hidden xl:block flex-none w-52 py-6 pr-4">
      <div class="sticky top-6 flex flex-col gap-0.5">
        <div class="text-captionXsBold uppercase tracking-wide text-nc-content-gray-muted px-2 mb-1">On this page</div>
        <button
          v-for="s in sections"
          :key="s.id"
          class="text-left px-2 py-1 rounded text-captionSm text-nc-content-gray-subtle hover:bg-nc-bg-gray-light hover:text-nc-content-gray-emphasis truncate"
          @click="scrollTo(s.id)"
        >
          {{ s.title }}
        </button>
      </div>
    </nav>
  </div>
</template>
