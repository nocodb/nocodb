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

/** wait until table list loads since meta load requires table list **/
// until(tables)
//   .toMatch((tables) => tables.length > 0)
//   .then(() => {
//     getMeta(route.params.title as string, true).finally(() => (loading.value = false))
//   })

watch(() => route.params.title, (tableTitle) => {
    until(tables)
    .toMatch((tables) => tables.length > 0)
    .then(() => {
      getMeta(tableTitle as string, true).finally(() => (loading.value = false))
    })
}, {immediate: true})

</script>

<template>
  <div class="w-full h-full">
<!--    <div v-if="loading" class="flex items-center justify-center h-full w-full">-->
<!--      <a-spin size="large" />-->
<!--    </div>-->

    <LazyTabsSmartsheet :active-tab="activeTab" />
  </div>
</template>
