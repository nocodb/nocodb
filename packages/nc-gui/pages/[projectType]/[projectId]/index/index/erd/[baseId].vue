<script setup lang="ts">
import { storeToRefs } from 'pinia'

const route = useRoute()

const { project, bases } = storeToRefs(useProject())

useMetas()

const tabStore = useTabs()
const { addErdTab } = tabStore
const { activeTab } = storeToRefs(tabStore)

watch(
  () => route.params.baseId,
  () => {
    until(bases)
      .toMatch((bases) => bases.length > 0)
      .then(() => {
        const base = bases.value.find((el) => el.id === route.params?.baseId) || bases.value.filter((el) => el.enabled)[0]
        addErdTab(base, project.value.title)
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full h-full !p-0">
    <LazyErdView :base-id="activeTab?.tabMeta?.base.id" />
  </div>
</template>
