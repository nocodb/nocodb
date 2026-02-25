<script setup lang="ts">
const { hideSidebar } = storeToRefs(useSidebarStore())

const router = useRouter()
const route = router.currentRoute

const { shouldShow: btbShouldShow } = useBackToBase()

const { sharedBaseId, options, isUseThisTemplate, isDuplicateDlgOpen, selectedWorkspace, templateName } = useCopySharedBase()

const { appInfo } = useGlobal()

const { $e } = useNuxtApp()

const { isDark, selectedTheme, isThemeEnabled } = useTheme()

const workspaceId = computed(() => route.value.params.typeOrId as string)

const websiteUrl = computed(() => {
  return appInfo.value.templatesRootUrl || 'https://nocodb.com'
})

const frameLoaded = ref(false)

onMounted(() => {
  hideSidebar.value = true
})

onBeforeUnmount(() => {
  hideSidebar.value = false
})

const sendIframeMessage = (message: any) => {
  const iframe = document.querySelector('iframe')
  if (iframe) {
    iframe.contentWindow?.postMessage(message, websiteUrl.value)
  }
}

useEventListener('message', (event) => {
  if (event.origin !== websiteUrl.value) return

  const { type, data } = event.data

  if (type === 'use-this-template' && data?.sharedBaseId) {
    $e('c:templates:use-this-template', {
      templateName: data.templateName ?? data.sharedBaseId,
    })

    options.value.includeData = true
    options.value.includeViews = true

    isUseThisTemplate.value = true

    templateName.value = (data.templateName as string) || ''

    sharedBaseId.value = data.sharedBaseId as string

    selectedWorkspace.value = workspaceId.value!

    isDuplicateDlgOpen.value = true
  } else if (type === 'tele-event' && data?.event) {
    $e(data.event, data.data)
  } else if (type === 'frameLoaded') {
    frameLoaded.value = true
  } else if (type === 'on-theme-initialized') {
    if (isThemeEnabled.value && selectedTheme.value) {
      sendIframeMessage({
        type: 'theme-mode-changed',
        data: isDark.value ? 'dark' : 'light',
      })
    }
  }
})

const embedPage = computed(() => {
  const page = 'templates'

  const searchQuery = new URLSearchParams()

  searchQuery.set('inApp', 'true')

  if (isThemeEnabled.value) {
    searchQuery.set('isThemeEnabled', `${isThemeEnabled.value}`)
  }

  return `${websiteUrl.value}/${page}/?${searchQuery.toString()}`
})

watch(isDark, (newVal) => {
  if (!isThemeEnabled.value) return

  if (newVal) {
    sendIframeMessage({
      type: 'theme-mode-changed',
      data: 'dark',
    })
  } else {
    sendIframeMessage({
      type: 'theme-mode-changed',
      data: 'light',
    })
  }
})
</script>

<template>
  <div>
    <NuxtLayout name="empty">
      <div class="overflow-hidden">
        <!-- Back-to-base full-width bar -->
        <DashboardBackToBaseBreadcrumbVariant />

        <!-- iframe fills remaining height after the bar -->
        <div class="overflow-hidden relative" :style="{ height: btbShouldShow ? 'calc(100dvh - 36px)' : '100dvh' }">
          <div v-if="!frameLoaded" class="w-full h-full p-[20%] flex items-center justify-center">
            <a-spin size="large" />
          </div>
          <iframe
            v-show="frameLoaded"
            :src="embedPage"
            width="100%"
            style="border: none; height: 100%"
            @load="frameLoaded = true"
          ></iframe>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>
