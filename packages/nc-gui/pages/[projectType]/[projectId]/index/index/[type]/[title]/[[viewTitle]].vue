<script setup lang="ts">
import type { TabItem } from '~/composables'
import { TabMetaInj, watchOnce } from '#imports'

const { getMeta } = useMetas()

const { tables } = useProject()

const route = useRoute()

const loading = ref(true)

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

if (tables.value.length) {
  getMeta(route.params.title as string, true).finally(() => (loading.value = false))
  loading.value = false
} else {
  /** wait until table list loads since meta load requires table list **/
  watchOnce(
    () => tables.value.length,
    (nextVal) => {
      if (!nextVal) return
      getMeta(route.params.title as string, true).finally(() => (loading.value = false))
      loading.value = false
    },
  )
}
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-full w-full">
    <a-spin size="large" />
  </div>
  <TabsSmartsheet v-else :key="route.params.title" :active-tab="activeTab" />
</template>
