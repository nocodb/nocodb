<script setup lang="ts">
import type { TabItem } from '~/lib'
import { TabMetaInj, computed, inject, ref, storeToRefs, until, useMetas, useProject, useRoute } from '#imports'
const { getMeta } = useMetas()

const projectStore = useProject()
const { tables } = storeToRefs(projectStore)

const route = useRoute()

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

const viewType = computed(() => {
  return route.params.type as string
})

watch(
  () => route.params.viewId,
  (viewId) => {
    /** wait until table list loads since meta load requires table list **/
    until(tables)
      .toMatch((tables) => tables.length > 0)
      .then(() => {
        getMeta(viewId as string, true)
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full h-full relative">
    <LazyTabsSmartsheet :key="viewType" :active-tab="activeTab" />
  </div>
</template>
