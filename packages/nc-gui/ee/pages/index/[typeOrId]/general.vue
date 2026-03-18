<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

// Redirect old /general to /more
navigateTo(`/${route.params.typeOrId}/more`, { replace: true })
</script>

<template>
  <div />
</template>
