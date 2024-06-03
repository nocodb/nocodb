<script lang="ts" setup>
const { isLoading, appInfo } = useGlobal()

const { sharedView } = useSharedView()

const router = useRouter()

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
      <a-layout-header class="flex items-center justify-between !bg-transparent !px-3 !py-2 border-b-1 border-gray-200 !h-[46px]">
        <div class="flex items-center gap-6 h-7">
          <a
            class="transition-all duration-200 cursor-pointer transform hover:scale-105"
            href="https://github.com/nocodb/nocodb"
            target="_blank"
            rel="noopener noreferrer"
          >
            <NcTooltip placement="bottom" class="flex">
              <template #title>
                {{ appInfo.version }}
              </template>
              <img width="96" alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
            </NcTooltip>
          </a>

          <div class="flex items-center gap-2 text-gray-900 text-sm">
            <template v-if="isLoading">
              <span data-testid="nc-loading">{{ $t('general.loading') }}</span>

              <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin ': isLoading }" />
            </template>

            <div v-else class="text-sm font-semibold truncate nc-shared-view-title flex gap-2 items-center">
              <GeneralViewIcon v-if="sharedView" class="h-4 w-4" :meta="sharedView" />
              {{ sharedView?.title }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <NcButton size="xs"> Sign up for Free </NcButton>
        </div>
      </a-layout-header>

      <div class="w-full overflow-hidden" style="height: calc(100vh - var(--topbar-height))">
        <slot />
      </div>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped>
#nc-app {
  @apply text-red-400 bg-gray-800;
  .ant-layout-header {
    @apply !h-[46px];
  }

  :deep(.nc-table-toolbar) {
    @apply px-2;
  }
}
</style>
