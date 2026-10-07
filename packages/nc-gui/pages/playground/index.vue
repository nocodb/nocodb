<script setup lang="ts">
import { playgroundNav } from './-helper/registry'
</script>

<template>
  <div class="max-w-6xl mx-auto p-8">
    <div class="mb-8">
      <h1 class="text-heading3 text-nc-content-gray-emphasis mb-1">NocoDB Playground</h1>
      <p class="text-body text-nc-content-gray-subtle max-w-2xl">
        Every design-system building block and the main product surfaces in one place. Open <b>Tokens</b> in the top bar to change
        the brand colour, grays, font, radii or any CSS variable — every page here, including the live app frames, updates as you
        edit.
      </p>
    </div>

    <div v-for="section in playgroundNav" :key="section.title" class="mb-8">
      <div class="text-captionSmBold uppercase tracking-wide text-nc-content-gray-muted mb-3">{{ section.title }}</div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <NuxtLink
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          class="group block p-4 !no-underline bg-nc-bg-default rounded-xl border-1 border-nc-border-gray-medium hover:border-nc-border-brand hover:shadow-hover focus-visible:outline-none focus-visible:border-nc-border-brand focus-visible:shadow-selected transition-all"
        >
          <div class="flex items-start gap-3">
            <div class="flex-none w-9 h-9 rounded-lg bg-nc-bg-brand flex items-center justify-center">
              <GeneralIcon :icon="item.icon" class="w-4.5 h-4.5 text-nc-content-brand" />
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="text-captionBold text-nc-content-gray-emphasis group-hover:text-nc-content-brand group-focus-visible:text-nc-content-brand transition-colors"
              >
                {{ item.name }}
              </div>
              <div class="text-captionSm text-nc-content-gray-subtle mt-1">{{ item.description }}</div>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
