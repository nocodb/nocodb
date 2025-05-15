<script lang="ts" setup>
const { isLoading } = useGlobal()

const { isMobileMode } = storeToRefs(useConfigStore())

const { sharedView, allowCSVDownload } = useSharedView()

const router = useRouter()

const route = router.currentRoute

const disableTopbar = computed(() => route.value.query?.disableTopbar === 'true')

const ncNotFound = computed(() => route.value.query?.ncNotFound === 'true')

onMounted(() => {
  // check if we are inside an iframe
  // if we are, communicate to the parent page whenever we navigate to a new url,
  // so that the parent page can respond to it properly.
  // E.g. by making the browser navigate to that url, and not just the iframe.
  // This is useful for integrating NocoDB into other products,
  // such as Outline (https://github.com/outline/outline/pull/4184).
  if (window.parent !== window) {
    const notifyLocationChange = (value: string) =>
      window.parent.postMessage(
        {
          event: 'locationchange',
          payload: { value },
        },
        '*',
      )

    router.afterEach((to) => notifyLocationChange(location.origin + to.fullPath))
    useEventListener(window, 'beforeunload', () => {
      const { href } = document.activeElement as { href?: string }
      if (href) notifyLocationChange(href)
    })
  }

  // handle meta title
  if (sharedView.value?.title) {
    document.title = `${sharedView.value.title}`
  } else {
    document.title = 'NocoDB'
  }
})
</script>

<script lang="ts">
export default {
  name: 'SharedView',
}
</script>

<template>
  <a-layout id="nc-app">
    <a-layout class="!flex-col bg-white">
      <GeneralPageDoesNotExist v-if="ncNotFound" />
      <template v-else>
        <a-layout-header
          v-if="!disableTopbar"
          class="nc-table-topbar flex items-center justify-between !bg-transparent !px-3 !py-2 border-b-1 border-gray-200 !h-[46px]"
        >
          <div class="flex items-center gap-6 h-7 max-w-[calc(100%_-_280px)] xs:max-w-[calc(100%_-_90px)]">
            <a
              class="transition-all duration-200 cursor-pointer transform hover:scale-105"
              href="https://github.com/nocodb/nocodb"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img width="96" alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="flex-none min-w-[96px]" />
            </a>

            <div class="flex items-center gap-2 text-gray-900 text-sm truncate">
              <template v-if="isLoading">
                <span data-testid="nc-loading">{{ $t('general.loading') }}</span>

                <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin ': isLoading }" />
              </template>

              <div v-else class="text-sm font-semibold truncate nc-shared-view-title flex gap-2 items-center">
                <GeneralViewIcon v-if="sharedView" class="h-4 w-4 ml-0.5" :meta="sharedView" />

                <span class="truncate">
                  {{ sharedView?.title }}
                </span>

                <NcTooltip v-if="sharedView?.description?.length" placement="bottom">
                  <template #title>
                    {{ sharedView?.description }}
                  </template>

                  <NcButton type="text" class="!hover:bg-transparent" size="xsmall">
                    <GeneralIcon icon="info" class="!w-3.5 !h-3.5 nc-info-icon text-gray-600" />
                  </NcButton>
                </NcTooltip>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <LazySmartsheetToolbarExport v-if="allowCSVDownload" />

            <a href="https://app.nocodb.com/#/signin" target="_blank" class="!no-underline xs:hidden" rel="noopener">
              <NcButton size="xs"> {{ $t('labels.signUpForFree') }} </NcButton>
            </a>
          </div>
        </a-layout-header>
        <div
          class="nc-shared-view-container w-full overflow-hidden"
          :class="{
            'nc-shared-mobile-view': isMobileMode,
          }"
        >
          <slot />
        </div>
      </template>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped>
#nc-app {
  .ant-layout-header {
    @apply !h-[46px];

    line-height: unset;
  }

  :deep(.nc-table-toolbar) {
    @apply px-2;
  }

  .nc-shared-view-container {
    height: calc(100vh - (var(--topbar-height) - 3.6px));

    @supports (height: 100dvh) {
      height: calc(100dvh - (var(--topbar-height) - 3.6px));
    }
  }
}
</style>
