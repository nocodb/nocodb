<script setup lang="ts">
import { storeToRefs } from 'pinia'

const route = useRoute()

const { sources } = storeToRefs(useBase())

const source = computed(() => sources.value.find((el) => el.id === route.params?.sourceId) || sources.value.filter((el) => el.enabled)[0])

useMetas()
</script>

<template>
  <div class="w-full h-full !p-0">
    <LazyErdView :source-id="source?.id" />
  </div>
</template>
