<script setup lang="ts">
import { TabType } from '~/lib'
import {storeToRefs} from "pinia";

const route = useRoute()

const { bases } = storeToRefs(useProject())

useMetas()

const tabStore = useTabs()
const {  addTab } = tabStore
const { activeTab, } = storeToRefs(tabStore)

watch(
  () => route.params.baseId,
  () => {
    until(bases)
      .toMatch((bases) => bases.length > 0)
      .then(() => {
        const base = bases.value.find((el) => el.id === route.params?.baseId) || bases.value.filter((el) => el.enabled)[0]
        addTab({
          id: `${TabType.ERD}-${base?.id}`,
          type: TabType.ERD,
          title: `ERD${base?.alias ? ` (${base.alias})` : ''}`,
          tabMeta: { base },
        })
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
