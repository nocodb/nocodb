<script setup lang="ts">
import type { WebSource } from '~/ee/utils/chat/thinkingTypes'

interface Props {
  source: WebSource
  index?: number
}

const props = defineProps<Props>()

const domain = computed(() => {
  try {
    return new URL(props.source.url).hostname.replace('www.', '')
  } catch {
    return props.source.url
  }
})

const faviconSrc = computed(
  () => props.source.favicon || `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(props.source.url)}`,
)
</script>

<template>
  <NcDropdown :trigger="['hover']" placement="top" overlay-class-name="nc-web-source-dropdown">
    <a
      v-e="['c:chat:web-source:click']"
      :href="source.url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-nc-bg-gray-light text-nc-content-gray-subtle hover:bg-nc-bg-gray-medium hover:text-nc-content-gray transition-colors duration-150 !no-underline"
    >
      <img :src="faviconSrc" :alt="domain" class="flex-none rounded-full" width="12" height="12" />
      <span class="text-captionSm tabular-nums">{{ index != null ? index + 1 : domain }}</span>
    </a>

    <template #overlay>
      <a
        :href="source.url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex flex-col gap-1.5 w-56 p-2.5 bg-nc-bg-default !no-underline"
      >
        <div class="flex items-center gap-1.5">
          <img :src="faviconSrc" :alt="domain" class="flex-none rounded-full" width="16" height="16" />
          <span class="text-bodySm text-nc-content-gray truncate">{{ domain }}</span>
        </div>
        <div v-if="source.title" class="text-bodySmBold text-nc-content-gray-emphasis line-clamp-2">
          {{ source.title }}
        </div>
      </a>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-web-source-dropdown {
  @apply !p-0;
}
</style>
