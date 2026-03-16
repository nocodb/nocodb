<script setup lang="ts">
interface Props {
  url: string
}

const props = defineProps<Props>()

const citationMap = inject<ComputedRef<Map<string, number>>>(
  'ChatUrlCitationMap',
  computed(() => new Map()),
)

const metaMap = inject<ComputedRef<Map<string, { title?: string; favicon?: string }>>>(
  'ChatWebSourceMetaMap',
  computed(() => new Map()),
)

const citationNumber = computed(() => citationMap.value.get(props.url) ?? 0)

const meta = computed(() => metaMap.value.get(props.url) ?? {})

const domain = computed(() => {
  try {
    return new URL(props.url).hostname.replace('www.', '')
  } catch {
    return props.url
  }
})

const faviconSrc = computed(
  () => meta.value.favicon || `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(props.url)}`,
)
</script>

<template>
  <NcDropdown :trigger="['hover']" placement="top" overlay-class-name="nc-url-source-dropdown">
    <a v-e="['c:chat:url-source:click']" :href="url" target="_blank" rel="noopener noreferrer" class="nc-url-source-badge">
      {{ citationNumber }}
    </a>

    <template #overlay>
      <a
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex flex-col gap-1.5 w-56 p-2.5 bg-nc-bg-default !no-underline"
      >
        <div class="flex items-center gap-1.5">
          <img :src="faviconSrc" :alt="domain" class="flex-none rounded-full" width="16" height="16" />
          <span class="text-bodySm text-nc-content-gray truncate">{{ domain }}</span>
        </div>
        <div v-if="meta.title" class="text-bodySmBold text-nc-content-gray-emphasis line-clamp-2">
          {{ meta.title }}
        </div>
      </a>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-url-source-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 9999px;
  background: var(--nc-bg-brand);
  color: var(--nc-content-brand);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  vertical-align: super;
  cursor: pointer;
  text-decoration: none !important;
  transition: background 150ms;

  &:hover {
    background: var(--nc-bg-brand-dark, var(--nc-bg-brand));
    opacity: 0.85;
  }
}
</style>

<style lang="scss">
.nc-url-source-dropdown {
  @apply !p-0;
}
</style>
