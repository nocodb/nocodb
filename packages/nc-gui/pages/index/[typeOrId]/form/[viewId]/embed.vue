<script setup lang="ts">
definePageMeta({
  public: true,
  requiresAuth: false,
  pageType: 'shared-view',
  // Forms have a parent <NuxtLayout> wrapper that double-applies the
  // shared-view layout — opt out and render an inline topbar inside the
  // shared embed component.
  layout: false,
  hasSidebar: false,
})

const route = useRoute()
const { t } = useI18n()

const { loadSharedView, sharedView, triggerNotFound } = useSharedView()

const isLoading = ref(true)

const baseUrl = computed(() => {
  const path = route.fullPath.replace(/\/embed\/?$/, '')
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
})

onMounted(async () => {
  isLoading.value = true
  try {
    await loadSharedView(route.params.viewId as string)
  } catch (e: any) {
    if (e?.response?.status === 404) {
      triggerNotFound()
    } else if (e?.response?.status !== 403) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <ShareCommonEmbedPage
    :title="sharedView?.title || t('general.untitled')"
    :view="sharedView ?? null"
    :base-url="baseUrl"
    header-label="activity.shareView"
    header-tooltip="activity.shareViewTooltip"
    :show-options="false"
    inline-topbar
  />
</template>
