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
        getMeta(tableTitle as string, true).finally(() => (loading.value = false))
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full h-full">
    <LazyTabsSmartsheet :active-tab="activeTab" />
  </div>
</template>
