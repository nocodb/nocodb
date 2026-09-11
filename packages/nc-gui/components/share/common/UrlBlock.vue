<script lang="ts" setup>
interface Props {
  url: string
}

const props = defineProps<Props>()

const { t } = useI18n()

const { copy } = useCopy()

const isCopied = ref(false)

// Split into protocol+host (muted) and path (emphasized) so the meaningful part reads first.
const urlParts = computed(() => {
  const value = props.url || ''
  if (!value) return { prefix: '', path: '' }

  try {
    const parsed = new URL(value)
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return {
      prefix: `${parsed.protocol}//${parsed.host}`,
      path: path === '/' ? '' : path,
    }
  } catch {
    const match = value.match(/^(https?:\/\/[^/]+)(.*)$/i)
    if (match) return { prefix: match[1], path: match[2] || '' }
    return { prefix: '', path: value }
  }
})

const onCopy = async () => {
  if (!props.url) return
  await copy(props.url)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 1500)
}
</script>

<template>
  <div class="px-3 py-2">
    <div
      class="nc-share-url-block flex items-stretch h-9 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg overflow-hidden shadow-default hover:border-nc-border-gray-dark transition-colors"
    >
      <div
        class="flex-1 min-w-0 flex items-center pl-3 pr-2 cursor-pointer truncate"
        role="button"
        :aria-label="$t('activity.copyLink')"
        :title="url"
        @click="onCopy"
      >
        <span class="nc-share-url-text truncate">
          <span class="nc-share-url-prefix">{{ urlParts.prefix }}</span
          ><span class="nc-share-url-path">{{ urlParts.path }}</span>
        </span>
      </div>
      <button
        v-e="['c:share:copy-url']"
        type="button"
        :aria-label="$t('activity.copyLink')"
        data-testid="nc-share-copy-url"
        class="nc-share-url-copy flex items-center gap-1.5 px-3 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light transition-colors"
        :class="
          isCopied
            ? 'bg-nc-bg-green-light text-nc-content-green-dark'
            : 'bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light'
        "
        @click="onCopy"
      >
        <GeneralIcon :icon="isCopied ? 'ncCheck' : 'ncCopy'" class="flex-none !w-3.5 !h-3.5" />
        <span>{{ isCopied ? $t('activity.copiedLink') : $t('activity.copyLink') }}</span>
      </button>
    </div>
    <div class="sr-only" aria-live="polite" role="status">
      <span v-if="isCopied">{{ t('activity.linkCopied') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-share-url-text {
  @apply font-mono text-bodySm leading-none;
}

.nc-share-url-prefix {
  @apply text-nc-content-gray-muted;
}

.nc-share-url-path {
  @apply text-nc-content-gray-emphasis;
}

.nc-share-url-copy {
  @apply outline-none;
  border-radius: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
