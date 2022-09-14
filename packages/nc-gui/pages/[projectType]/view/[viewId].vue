<script setup lang="ts">
import { message } from 'ant-design-vue'
import {
  ReadonlyInj,
  ReloadViewDataHookInj,
  createEventHook,
  definePageMeta,
  extractSdkResponseErrorMsg,
  provide,
  ref,
  useRoute,
  useSharedView,
} from '#imports'

definePageMeta({
  public: true,
  requiresAuth: false,
  layout: 'shared-view',
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()
provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReadonlyInj, true)

const { loadSharedView } = useSharedView()
const showPassword = ref(false)

try {
  await loadSharedView(route.params.viewId as string)
} catch (e: any) {
  if (e?.response?.status === 403) {
    showPassword.value = true
  } else {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <NuxtLayout id="content" class="flex" name="shared-view">
    <div v-if="showPassword">
      <SharedViewAskPassword v-model="showPassword" />
    </div>

    <SharedViewGrid v-else />
  </NuxtLayout>
</template>
