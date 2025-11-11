<script setup lang="ts">
const { hideSidebar } = storeToRefs(useSidebarStore())

const router = useRouter()
const route = router.currentRoute

const { sharedBaseId, options, isUseThisTemplate, isDuplicateDlgOpen, selectedWorkspace, templateName } = useCopySharedBase()

const { appInfo } = useGlobal()

const workspaceId = computed(() => route.value.params.typeOrId as string)

const websiteUrl = computed(() => {
  return appInfo.value.marketingRootUrl || 'https://nocodb.com'
})

const frameLoaded = ref(false)

onMounted(() => {
  hideSidebar.value = true
})

onBeforeUnmount(() => {
  hideSidebar.value = false
})

useEventListener('message', (event) => {
  if (event.origin !== websiteUrl.value) return

  const { type, data } = event.data

  if (type === 'use-this-template' && data?.sharedBaseId) {
    console.log('template', data)

    options.value.includeData = true
    options.value.includeViews = true

    isUseThisTemplate.value = true

    templateName.value = (data.templateName as string) || ''

    sharedBaseId.value = data.sharedBaseId as string

    selectedWorkspace.value = workspaceId.value!

    isDuplicateDlgOpen.value = true
  } else if (type === 'frameLoaded') {
    frameLoaded.value = true
  }
})

const embedPage = computed(() => {
  const page = 'templates'

  const searchQuery = new URLSearchParams()

  searchQuery.set('inApp', 'true')

  return `${websiteUrl.value}/${page}/?${searchQuery.toString()}`
})
</script>

<template>
  <div>
    <NuxtLayout name="empty">
      <div class="overflow-hidden">
        <div v-if="!frameLoaded" class="w-full nc-h-screen p-[20%] flex items-center justify-center">
          <a-spin size="large" />
        </div>
        <iframe
          v-show="frameLoaded"
          :src="embedPage"
          width="100%"
          style="border: none; height: 100dvh"
          class="nc-h-screen"
          @load="frameLoaded = true"
        ></iframe>
      </div>
    </NuxtLayout>
  </div>
</template>
