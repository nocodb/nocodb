<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Define SmartsheetScriptDetails as an async component
const SmartsheetScriptDetails = defineAsyncComponent(() => import('./Details.vue'))

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
        <SmartsheetScriptDetails />
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
