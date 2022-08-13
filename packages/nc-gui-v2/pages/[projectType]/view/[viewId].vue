<script setup lang="ts">
import { ReadonlyInj, ReloadViewDataHookInj } from '~/context'

import { useRoute } from '#imports'
definePageMeta({
  requiresAuth: false,
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()
provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReadonlyInj, ref(true))

const { loadSharedView } = useSharedView()
const showPassword = ref(false)

try {
  await loadSharedView(route.params.viewId as string)
} catch (e) {
  showPassword.value = true
}
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <div v-if="showPassword">
      <SharedViewAskPassword v-model="showPassword" />
    </div>
    <SharedViewGrid v-else />
  </NuxtLayout>
</template>
