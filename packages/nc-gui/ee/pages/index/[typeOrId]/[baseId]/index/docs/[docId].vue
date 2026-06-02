<script setup lang="ts">
import { useTitle } from '@vueuse/core'

const route = useRoute()

const documentsStore = useDocumentsStore()
const basesStore = useBases()

const { openedProject } = storeToRefs(basesStore)
const { activeDocument } = storeToRefs(documentsStore)

const docId = computed(() => route.params.docId as string)

// Set activeDocumentId when route changes
watch(
  docId,
  (id) => {
    if (id) {
      documentsStore.setActiveDocumentId(id)
    }
  },
  { immediate: true },
)

// Update browser tab title reactively
const pageTitle = computed(() => {
  if (!activeDocument.value?.title) return ''
  return `${activeDocument.value.title} | ${openedProject.value?.title ?? ''}`
})
useTitle(pageTitle)

// Clear activeDocumentId when leaving the page
onBeforeRouteLeave(() => {
  documentsStore.setActiveDocumentId(undefined)
})
</script>

<template>
  <div class="flex flex-col h-full w-full" data-testid="docs-opened-page">
    <!-- Key by docId so the editor (and its collaborative Y.Doc session) is
         recreated per document instead of reused across doc→doc navigation. -->
    <LazyDocEditor v-if="docId" :key="docId" :doc-id="docId" />
  </div>
</template>
