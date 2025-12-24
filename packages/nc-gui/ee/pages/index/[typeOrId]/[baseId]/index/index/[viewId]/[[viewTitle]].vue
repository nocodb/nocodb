<script setup lang="ts">
const { getMeta } = useMetas()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

const route = useRoute()

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

watch(
  () => route.params.viewId,
  (viewId) => {
    console.log('[viewId page] watch triggered', {
      viewId,
      tablesLength: tables.value.length,
      baseId: baseStore.baseId,
    })
    /** wait until table list loads since meta load requires table list **/
    until(tables)
      .toMatch((tables) => {
        console.log('[viewId page] until check - tables.length:', tables.length)
        return tables.length > 0
      })
      .then(() => {
        console.log('[viewId page] tables loaded, calling getMeta')
        getMeta(baseStore.baseId as string, viewId as string, undefined, undefined, undefined, true)
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full h-full relative">
    <TabsSmartsheet :active-tab="activeTab" />
  </div>
</template>
