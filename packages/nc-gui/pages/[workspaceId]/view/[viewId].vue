<script setup lang="ts">
import { definePageMeta, extractSdkResponseErrorMsg, message, ref, useRoute, useSharedView } from '#imports'

definePageMeta({
  public: true,
  requiresAuth: false,
  layout: 'shared-view',
})

const route = useRoute()

const { loadSharedView } = useSharedView()
const { isViewDataLoading } = storeToRefs(useViewsStore())

const showPassword = ref(false)

onMounted(async () => {
  isViewDataLoading.value = true
  try {
    await loadSharedView(route.params.viewId as string)
  } catch (e: any) {
    if (e?.response?.status === 403) {
      showPassword.value = true
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
  <NuxtLayout class="flex" name="shared-view">
    <div v-if="showPassword">
      <LazySharedViewAskPassword v-model="showPassword" />
    </div>

    <LazySharedViewGrid v-else />
  </NuxtLayout>
</template>
