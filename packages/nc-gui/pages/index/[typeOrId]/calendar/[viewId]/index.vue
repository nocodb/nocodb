<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

definePageMeta({
  public: true,
  requiresAuth: false,
  layout: 'shared-view',
  hasSidebar: false,
  pageType: 'shared-view',
})

const route = useRoute()

const { loadSharedView, triggerNotFound } = useSharedView()

const showPassword = ref(false)

const showPageNotFound = ref(false)

try {
  await loadSharedView(route.params.viewId as string)
} catch (e: any) {
  if (e?.response?.status === 403) {
    showPassword.value = true
  } else if (e?.response?.status === 404) {
    showPageNotFound.value = true
  } else {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(() => {
  if (!showPageNotFound.value) return

  triggerNotFound()
})
</script>

<template>
  <div v-if="showPassword">
    <LazySharedViewAskPassword v-model="showPassword" :view-type="ViewTypes.CALENDAR" />
  </div>
  <LazySharedViewCalendar v-else />
</template>
