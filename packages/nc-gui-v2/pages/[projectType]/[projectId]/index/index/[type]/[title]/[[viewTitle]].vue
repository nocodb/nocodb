<script setup lang="ts">
const { getMeta } = useMetas()
const route = useRoute()

await getMeta(route.params.title as string, true)
</script>

<template>
  <TabsSmartsheet />
</template>

<style scoped></style>
