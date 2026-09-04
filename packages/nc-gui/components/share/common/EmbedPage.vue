<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'

interface Props {
  /** Display title for the embedded resource (view name, dashboard name, etc.). */
  title: string
  /** Public-facing URL of the resource (without `/embed`). Used as the iframe src and copy code source. */
  baseUrl: string
  /** i18n key for the small label above the heading (e.g. "Share View"). */
  headerLabel?: string
  /** i18n key for the (?) info tooltip next to the header label. */
  headerTooltip?: string
  /** Show hide-toolbar / hide-topbar toggles. */
  showOptions?: boolean
  /**
   * Render a self-contained NocoDB topbar above the embed UI. Use when the
   * page can't rely on the `shared-view` layout (e.g. forms, where the
   * parent NuxtLayout double-wraps).
   */
  inlineTopbar?: boolean
  /** Optional view (used by the inline topbar to render the view-type icon). */
  view?: ViewType | null
}

const props = withDefaults(defineProps<Props>(), {
  headerLabel: 'activity.shareView',
  headerTooltip: 'activity.shareViewTooltip',
  showOptions: true,
  inlineTopbar: false,
  view: null,
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
  <div class="nc-share-embed-page flex flex-col min-h-screen bg-nc-bg-default">
    <!-- Inline NocoDB topbar — opt-in for pages whose layout chain double-wraps
         the shared-view header (forms). Mirrors layouts/shared-view.vue exactly
         so the visual style stays consistent. -->
    <div
      v-if="inlineTopbar"
      class="nc-embed-topbar flex items-center justify-between !bg-transparent !px-3 !py-2 border-b-1 border-nc-border-gray-medium !h-[46px] shrink-0"
    >
      <div class="flex items-center gap-6 h-7 max-w-[calc(100%_-_280px)] xs:max-w-[calc(100%_-_90px)]">
        <a
          class="transition-all duration-200 cursor-pointer transform hover:scale-105"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img v-if="isDark" width="96" alt="NocoDB" src="~/assets/img/brand/text.png" class="flex-none min-w-[96px]" />
          <img v-else width="96" alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="flex-none min-w-[96px]" />
        </a>

        <div class="flex items-center gap-2 text-nc-content-gray-emphasis truncate">
          <div class="text-bodyBold truncate flex gap-2 items-center">
            <GeneralViewIcon v-if="view" class="h-4 w-4 ml-0.5" :meta="view" />
            <span class="truncate">{{ title }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <DashboardMiniSidebarTheme placement="bottom" render-as-btn />
      </div>
    </div>

    <div class="border-b-1 border-nc-border-gray-medium">
      <div class="max-w-[1440px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
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

          <div v-if="showOptions" class="flex flex-col gap-2 mt-2">
            <label class="flex items-center gap-2 cursor-pointer w-fit">
              <NcSwitch v-model:checked="hideToolbar" size="small" data-testid="nc-embed-hide-toolbar" />
              <span class="text-bodyDefaultSm text-nc-content-gray-extreme">
                {{ t('activity.shareBase.embedHideToolbar') }}
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer w-fit">
              <NcSwitch v-model:checked="hideTopbar" size="small" data-testid="nc-embed-hide-topbar" />
              <span class="text-bodyDefaultSm text-nc-content-gray-extreme">
                {{ t('activity.shareBase.embedHideTopbar') }}
              </span>
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

    <div class="flex-1 bg-nc-bg-gray-extralight">
      <div class="max-w-[1440px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
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
