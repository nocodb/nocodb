<script setup lang="ts">
import { TabItem } from '~/composables'
import { TabMetaInj } from '~/context'

const { getMeta } = useMetas()
const route = useRoute()
const loading = ref(true)

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

getMeta(route.params.title as string, true).finally(() => {
  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-full w-full">
    <a-spin size="large" />
  </div>
  <TabsSmartsheet :active-tab="activeTab" :key="route.params.title" v-else />
</template>

<style scoped></style>
