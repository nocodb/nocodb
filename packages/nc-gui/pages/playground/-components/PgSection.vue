<script setup lang="ts">
/** A titled block on a playground page; `id` is the anchor PgPage's TOC scrolls to. */
defineProps<{
  id: string
  title: string
  description?: string
  /** source component name(s), shown as a mono hint */
  source?: string
}>()
</script>

<template>
  <section :id="id" class="scroll-mt-4 mb-10">
    <div class="flex items-baseline gap-3 mb-1">
      <h2 class="text-subHeading2 text-nc-content-gray-emphasis">{{ title }}</h2>
      <code v-if="source" class="text-captionXs text-nc-content-gray-muted font-mono">{{ source }}</code>
    </div>
    <p v-if="description" class="text-caption text-nc-content-gray-subtle mb-3 max-w-3xl">{{ description }}</p>
    <div class="flex flex-col gap-3" :class="{ 'mt-3': !description }">
      <slot />
    </div>
  </section>
</template>
