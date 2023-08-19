<script setup lang="ts">
import { storeToRefs } from 'pinia'

const route = useRoute()

const { bases } = storeToRefs(useProject())

const base = computed(() => bases.value.find((el) => el.id === route.params?.baseId) || bases.value.filter((el) => el.enabled)[0])

useMetas()
</script>

<template>
  <div class="w-full h-full !p-0">
    <LazyErdView :base-id="base?.id" />
  </div>
</template>
