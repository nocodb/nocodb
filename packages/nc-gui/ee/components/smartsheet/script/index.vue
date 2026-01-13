<script setup lang="ts">
const scriptStore = useScriptStore()
const { updateBaseSchema } = scriptStore
const { isLoadingScript } = storeToRefs(scriptStore)

onMounted(async () => {
  await updateBaseSchema()
})
</script>

<template>
  <div style="height: calc(100svh)" class="nc-container flex flex-col h-full">
    <LazySmartsheetTopbar />
    <template v-if="!isLoadingScript">
      <Suspense>
        <LazySmartsheetScriptDetails />
        <template #fallback>
          <div class="flex items-center justify-center h-full">
            <GeneralLoader size="xlarge" />
          </div>
        </template>
      </Suspense>
    </template>
    <div v-else class="flex items-center justify-center h-full">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>
