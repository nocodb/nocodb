<script lang="ts" setup>
import { iconMap, navigateTo, useEventListener, useRouter } from '#imports'

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
      <a-layout-header class="flex !bg-primary items-center text-white pl-3 pr-4 shadow-lg">
        <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105" @click="navigateTo('/')">
          <a-tooltip placement="bottom">
            <template #title>
              {{ appInfo.version }}
            </template>
            <img width="35" alt="NocoDB" src="~/assets/img/icons/256x256-trans.png" />
          </a-tooltip>
        </div>

        <div>
          <div class="flex justify-center items-center">
            <div class="flex items-center gap-2 ml-3 text-white">
              <template v-if="isLoading">
                <span class="text-white" data-testid="nc-loading">{{ $t('general.loading') }}</span>

                <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin ': isLoading }" />
              </template>

              <div v-else class="text-xl font-semibold truncate text-white nc-shared-view-title flex gap-2 items-center">
                <GeneralViewIcon v-if="sharedView" class="!text-xl" :meta="sharedView" />
                {{ sharedView?.title }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1" />
      </a-layout-header>

      <div class="w-full overflow-hidden" style="height: calc(100vh - var(--topbar-height))">
        <slot />
      </div>
    </a-layout>
  </a-layout>
</template>
