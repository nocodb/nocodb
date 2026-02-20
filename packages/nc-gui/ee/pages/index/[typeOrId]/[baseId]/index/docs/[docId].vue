<script setup lang="ts">
import { useTitle } from '@vueuse/core'

const route = useRoute()

const docsStore = useDocsStore()
const basesStore = useBases()

const { openedProject } = storeToRefs(basesStore)
const { activeDoc } = storeToRefs(docsStore)

const docId = computed(() => route.params.docId as string)

// Set activeDocId when route changes
watch(
  docId,
  (id) => {
    if (id) {
      docsStore.activeDocId = id
    }
  },
  { immediate: true },
)

// Update browser tab title reactively
const pageTitle = computed(() => {
  if (!activeDoc.value?.title) return ''
  return `${activeDoc.value.title} | ${openedProject.value?.title ?? ''}`
})
useTitle(pageTitle)

// Clear activeDocId when leaving the page
onBeforeRouteLeave(() => {
  docsStore.activeDocId = undefined
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <LazyDocEditor v-if="docId" :doc-id="docId" />
  </div>
</template>
