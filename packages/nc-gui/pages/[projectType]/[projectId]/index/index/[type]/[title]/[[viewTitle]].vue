<script setup lang="ts">
const { getMeta } = useMetas()
const route = useRoute()
const loading = ref(true)

getMeta(route.params.title as string, true).finally(() => {
  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-full w-full">
    <a-spin size="large" />
  </div>
  <TabsSmartsheet v-else />
</template>

<style scoped></style>
