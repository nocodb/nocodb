<script setup lang="ts">
import { message } from 'ant-design-vue'
import {
  CellUrlConfigInj,
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

const parseUrlRules = (serialized: string | undefined) => {
  if (!serialized) return undefined
  try {
    const rules: Array<[RegExp, {}]> = Object.entries(JSON.parse(serialized)).map(([key, value]) => [
      new RegExp(key),
      value as {},
    ])
    return rules
  } catch (err) {
    console.error(err)
    return undefined
  }
}
provide(CellUrlConfigInj, {
  behavior: route.query.url_behavior as string,
  overlay: route.query.url_overlay as string,
  rules: parseUrlRules(route.query.url_rules as string),
})

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
