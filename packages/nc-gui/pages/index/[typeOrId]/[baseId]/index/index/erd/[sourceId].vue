<script setup lang="ts">
import { storeToRefs } from 'pinia'

const route = useRoute()

const { base, sources } = storeToRefs(useBase())

useMetas()

const tabStore = useTabs()
const { addErdTab } = tabStore
const { activeTab } = storeToRefs(tabStore)

watch(
  () => route.params.sourceId,
  () => {
    until(sources)
      .toMatch((sources) => sources.length > 0)
      .then(() => {
        const source = sources.value.find((el) => el.id === route.params?.sourceId) || sources.value.filter((el) => el.enabled)[0]
        addErdTab(source, base.value.title)
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full h-full !p-0">
    <LazyErdView :source-id="activeTab?.tabMeta?.source.id" />
  </div>
</template>
