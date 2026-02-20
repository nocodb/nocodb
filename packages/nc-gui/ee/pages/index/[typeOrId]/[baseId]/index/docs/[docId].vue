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

// Update page title
watch(
  () => activeDoc.value?.title,
  (title) => {
    if (!title) return
    useTitle(`${title} | ${openedProject.value?.title}`)
  },
  { immediate: true },
)

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
