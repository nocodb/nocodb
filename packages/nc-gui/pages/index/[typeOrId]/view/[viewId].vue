<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

definePageMeta({
  public: true,
  requiresAuth: false,
  layout: 'shared-view',
  hasSidebar: false,
})

const route = useRoute()

const { loadSharedView, meta, triggerNotFound } = useSharedView()
const { isViewDataLoading } = storeToRefs(useViewsStore())

provide(MetaInj, meta)

const showPassword = ref(false)

onMounted(async () => {
  isViewDataLoading.value = true
  try {
    await loadSharedView(route.params.viewId as string)
  } catch (e: any) {
    if (e?.response?.status === 403) {
      showPassword.value = true
    } else if (e?.response?.status === 404) {
      triggerNotFound()
    } else {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  } finally {
    isViewDataLoading.value = false
  }
})
</script>

<template>
  <div v-if="showPassword">
    <LazySharedViewAskPassword v-model="showPassword" />
  </div>

  <LazySharedViewGrid v-else-if="meta" :view-type="ViewTypes.GRID" />
</template>
