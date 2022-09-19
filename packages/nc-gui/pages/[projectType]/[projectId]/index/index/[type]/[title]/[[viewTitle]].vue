<script setup lang="ts">
import type { TabItem } from '~/composables'
import { TabMetaInj } from '#imports'

const { getMeta } = useMetas()

const { project, projectLoadedHook, projectAndTablesLoaded } = useProject()

const route = useRoute()

const loading = ref(true)

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

/** wait until project and table loads since meta load requires table list **/
watch(
  projectAndTablesLoaded,
  (nextVal) => {
    if (!nextVal) return
    getMeta(route.params.title as string, true).finally(() => (loading.value = false))
    loading.value = false
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-full w-full">
    <a-spin size="large" />
  </div>
  <TabsSmartsheet v-else :key="route.params.title" :active-tab="activeTab" />
</template>
