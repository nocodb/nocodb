<script setup lang="ts">
import { PlaygroundTokenEditorOpenInj } from '../-helper/registry'

/** Page frame for a playground page: heading, optional TOC built from `sections`. */
defineProps<{
  title: string
  description?: string
  sections?: Array<{ id: string; title: string }>
  /** full-size surfaces (modal shells, settings): no max width, no TOC column */
  wide?: boolean
}>()

// the TOC gives up its column while the token editor squeezes the page
const isTokenEditorOpen = inject(PlaygroundTokenEditorOpenInj, ref(false))

// scrollIntoView would also scroll the overflow-hidden app wrappers and push the shell off-screen
function scrollTo(id: string) {
  const el = document.getElementById(id)
  const scroller = el?.closest<HTMLElement>('.nc-playground-main')
  if (!el || !scroller) return
  const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16
  scroller.scrollTo({ top, behavior: 'smooth' })
}
</script>

<template>
  <div class="flex min-h-full">
    <div class="flex-1 min-w-0 px-8 py-6">
      <div class="mx-auto" :class="{ 'max-w-6xl': !wide }">
        <div class="mb-6">
          <h1 class="text-heading3 text-nc-content-gray-emphasis">{{ title }}</h1>
          <p v-if="description" class="text-body text-nc-content-gray-subtle mt-1 max-w-3xl">{{ description }}</p>
        </div>
        <slot />
      </div>
    </div>
    <nav v-if="sections?.length && !wide && !isTokenEditorOpen" class="hidden xl:block flex-none w-52 py-6 pr-4">
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
