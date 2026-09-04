<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: false,
  layout: 'shared-view',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const baseStore = useBase()
const { loadProject } = baseStore
const { base } = storeToRefs(baseStore)

const baseUrl = computed(() => {
  const path = route.fullPath.replace(/\/embed\/?$/, '')
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
})

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
  <ShareCommonEmbedPage
    :title="base?.title || t('general.untitled')"
    :base-url="baseUrl"
    header-label="activity.shareBase.embedBase"
    header-tooltip="activity.shareBase.embedTooltip"
  />
</template>
