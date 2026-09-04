<script lang="ts" setup>
interface Props {
  /** Display title for the embedded resource (view name, dashboard name, etc.). */
  title: string
  /** Public-facing URL of the resource (without `/embed`). Used as the iframe src and copy code source. */
  baseUrl: string
  /** i18n key for the small label above the heading (e.g. "Embed view"). */
  headerLabel?: string
  /** i18n key for the (?) info tooltip next to the header label. */
  headerTooltip?: string
  /** Show hide-toolbar / hide-topbar toggles. */
  showOptions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  headerLabel: 'activity.embedView',
  headerTooltip: 'activity.shareViewTooltip',
  showOptions: true,
})

const { t } = useI18n()
const { copy } = useCopy()
const { isDark } = useTheme()

const hideToolbar = ref(false)
const hideTopbar = ref(false)

const embedSrc = computed(() => {
  if (!props.baseUrl) return ''
  const params = ['embed=true']
  if (props.showOptions) {
    if (hideToolbar.value) params.push('disableToolbar=true')
    if (hideTopbar.value) params.push('disableTopbar=true')
  }
  const sep = props.baseUrl.includes('?') ? '&' : '?'
  return `${props.baseUrl}${sep}${params.join('&')}`
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
</script>

<template>
  <div class="nc-share-embed-page nc-h-screen overflow-y-auto bg-nc-bg-default">
    <!-- Top configuration section: logo, then label + title + options (left) and embed code (right) -->
    <div class="border-b-1 border-nc-border-gray-medium">
      <div class="max-w-[1440px] mx-auto px-8 py-8">
        <a
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block mb-6 transition-transform duration-200 hover:scale-105"
          aria-label="NocoDB"
        >
          <img v-if="isDark" width="96" alt="NocoDB" src="~/assets/img/brand/text.png" class="min-w-[96px]" />
          <img v-else width="96" alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="min-w-[96px]" />
        </a>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
              <span>{{ t(headerLabel) }}</span>
              <NcTooltip v-if="headerTooltip">
                <template #title>{{ t(headerTooltip) }}</template>
                <GeneralIcon icon="info" class="!w-3.5 !h-3.5 cursor-pointer" />
              </NcTooltip>
            </div>
            <div class="text-heading3 text-nc-content-gray-emphasis truncate">
              {{ title || t('general.untitled') }}
            </div>

            <div v-if="showOptions" class="flex flex-col gap-3 mt-2">
              <label class="flex items-start gap-2.5 cursor-pointer w-fit">
                <NcSwitch v-model:checked="hideToolbar" size="xsmall" class="mt-0.5" data-testid="nc-embed-hide-toolbar" />
                <div class="flex flex-col">
                  <span class="text-bodyDefaultSm font-weight-600 text-nc-content-gray-emphasis">
                    {{ t('activity.shareBase.embedHideToolbar') }}
                  </span>
                  <span class="text-bodySm text-nc-content-gray-subtle leading-snug">
                    {{ t('activity.shareBase.embedHideToolbarHint') }}
                  </span>
                </div>
              </label>
              <label class="flex items-start gap-2.5 cursor-pointer w-fit">
                <NcSwitch v-model:checked="hideTopbar" size="xsmall" class="mt-0.5" data-testid="nc-embed-hide-topbar" />
                <div class="flex flex-col">
                  <span class="text-bodyDefaultSm font-weight-600 text-nc-content-gray-emphasis">
                    {{ t('activity.shareBase.embedHideTopbar') }}
                  </span>
                  <span class="text-bodySm text-nc-content-gray-subtle leading-snug">
                    {{ t('activity.shareBase.embedHideTopbarHint') }}
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
              <GeneralIcon icon="ncCode" class="!w-3.5 !h-3.5" />
              <span>{{ t('activity.shareBase.embedCode') }}</span>
            </div>
            <div
              class="text-bodySm font-mono text-nc-content-gray-subtle2 bg-nc-bg-gray-extralight border-1 border-nc-border-gray-light rounded-md p-3 break-all whitespace-pre-wrap"
            >
              {{ embedCode }}
            </div>
            <div class="flex justify-end">
              <NcButton
                v-e="['c:share:embed-copy']"
                size="small"
                type="secondary"
                data-testid="nc-embed-copy-code"
                @click="copyEmbedCode"
              >
                <div class="flex items-center gap-1.5">
                  <GeneralIcon :icon="isCopied ? 'ncCheck' : 'ncCopy'" class="!w-3.5 !h-3.5" />
                  <span>{{ isCopied ? t('activity.copiedLink') : t('activity.shareBase.copyEmbedCode') }}</span>
                </div>
              </NcButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview section: desktop + mobile -->
    <div class="bg-nc-bg-gray-extralight">
      <div class="max-w-[1440px] mx-auto px-8 pt-8 pb-12 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncMonitor" class="!w-3.5 !h-3.5" />
            <span>{{ t('activity.shareBase.desktopPreview') }}</span>
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
              :title="`Embed preview – ${title || 'Shared resource'}`"
            />
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncSmartphone" class="!w-3.5 !h-3.5" />
            <span>{{ t('activity.shareBase.mobilePreview') }}</span>
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
              :title="`Mobile embed preview – ${title || 'Shared resource'}`"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
