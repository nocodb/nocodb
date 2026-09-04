<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: false,
  layout: 'shared-view',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { copy } = useCopy()

const baseStore = useBase()
const { loadProject } = baseStore
const { base } = storeToRefs(baseStore)

const sharedBaseUrl = computed(() => {
  // route.fullPath looks like `/base/<uuid>/embed`. Strip trailing /embed.
  const path = route.fullPath.replace(/\/embed\/?$/, '')
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
})

const embedSrc = computed(() => {
  const url = sharedBaseUrl.value
  if (!url) return ''
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}embed=true`
})

const embedCode = computed(() => {
  if (!embedSrc.value) return ''
  return `<iframe class="nocodb-embed" src="${embedSrc.value}" frameborder="0" onmousewheel="" width="100%" height="533" style="background: transparent; border: 1px solid #ccc;"></iframe>`
})

const isCopied = ref(false)

const copyEmbedCode = async () => {
  if (!embedCode.value) return
  await copy(embedCode.value)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

onBeforeMount(async () => {
  try {
    await loadProject()
  } catch (e: any) {
    if (e.response?.status === 403) {
      message.error(t('msg.error.projectNotAccessible'))
      router.replace('/')
      return
    }
    const error = await extractSdkResponseErrorMsgv2(e)
    message.error(error.message)
  }
})
</script>

<template>
  <div class="nc-share-base-embed flex flex-col min-h-screen bg-nc-bg-default">
    <div class="border-b-1 border-nc-border-gray-medium">
      <div class="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
            <span>{{ $t('activity.shareBase.embedBase') }}</span>
            <NcTooltip>
              <template #title>{{ $t('activity.shareBase.embedTooltip') }}</template>
              <GeneralIcon icon="info" class="!w-3.5 !h-3.5 cursor-pointer" />
            </NcTooltip>
          </div>
          <div class="text-heading3 font-semibold text-nc-content-gray-emphasis truncate">
            {{ base?.title || $t('general.untitled') }}
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncCode" class="!w-3.5 !h-3.5" />
            <span>{{ $t('activity.shareBase.embedCode') }}</span>
          </div>
          <div
            class="text-bodySm font-mono text-nc-content-gray-subtle2 bg-nc-bg-gray-extralight border-1 border-nc-border-gray-light rounded-md p-3 break-all whitespace-pre-wrap"
          >
            {{ embedCode }}
          </div>
          <div class="flex justify-end">
            <NcButton
              v-e="['c:share:base:embed-copy']"
              size="small"
              type="secondary"
              data-testid="nc-embed-copy-code"
              @click="copyEmbedCode"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon :icon="isCopied ? 'ncCheck' : 'ncCopy'" class="!w-3.5 !h-3.5" />
                <span>{{ isCopied ? $t('activity.copiedLink') : $t('activity.shareBase.copyEmbedCode') }}</span>
              </div>
            </NcButton>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 bg-nc-bg-gray-extralight">
      <div class="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncMonitor" class="!w-3.5 !h-3.5" />
            <span>{{ $t('activity.shareBase.desktopPreview') }}</span>
          </div>
          <div
            class="bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-md overflow-hidden shadow-sm"
            style="height: 540px"
          >
            <iframe
              v-if="embedSrc"
              :src="embedSrc"
              class="w-full h-full"
              frameborder="0"
              :title="`Embed preview – ${base?.title || 'Base'}`"
            />
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncSmartphone" class="!w-3.5 !h-3.5" />
            <span>{{ $t('activity.shareBase.mobilePreview') }}</span>
          </div>
          <div
            class="bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-md overflow-hidden shadow-sm mx-auto w-full"
            style="height: 540px; max-width: 360px"
          >
            <iframe
              v-if="embedSrc"
              :src="embedSrc"
              class="w-full h-full"
              frameborder="0"
              :title="`Mobile embed preview – ${base?.title || 'Base'}`"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-share-base-embed {
  font-family: inherit;
}
</style>
