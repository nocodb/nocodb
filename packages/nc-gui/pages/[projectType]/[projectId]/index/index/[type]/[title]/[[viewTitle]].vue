<script setup lang="ts">
import type { TabItem } from '~/lib'
import { TabMetaInj, computed, inject, ref, until, useMetas, useProject, useRoute } from '#imports'

const { getMeta } = useMetas()

const { tables } = useProject()

const route = useRoute()

const loading = ref(true)

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

watch(
  () => route.params.title,
  (tableTitle) => {
    /** wait until table list loads since meta load requires table list **/
    until(tables)
      .toMatch((tables) => tables.length > 0)
      .then(() => {
        loading.value = true
        getMeta(tableTitle as string, true).finally(() => (loading.value = false))
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full h-full relative">
    <LazyTabsSmartsheet :active-tab="activeTab" />

    <general-overlay :model-value="loading" inline transition class="!bg-opacity-15">
      <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>
  </div>
</template>
