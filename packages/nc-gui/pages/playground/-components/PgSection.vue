<script setup lang="ts">
defineProps<{
  id: string
  title: string
  description?: string
  source?: string
}>()
</script>

<template>
  <section :id="id" class="scroll-mt-4 mb-10">
    <div class="flex items-baseline gap-3 mb-1">
      <h2 class="flex-none whitespace-nowrap text-subHeading2 text-nc-content-gray-emphasis">{{ title }}</h2>
      <NcTooltip v-if="source" show-on-truncate-only class="min-w-0 truncate">
        <template #title>{{ source }}</template>
        <code class="text-captionXs text-nc-content-gray-muted font-mono">{{ source }}</code>
      </NcTooltip>
    </div>
    <p v-if="description" class="text-caption text-nc-content-gray-subtle mb-3 max-w-3xl">{{ description }}</p>
    <div class="flex flex-col gap-3" :class="{ 'mt-3': !description }">
      <slot />
    </div>
  </section>
</template>
