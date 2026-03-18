<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

// Redirect old settings URL to new flat URL
navigateTo(`/${route.params.typeOrId}/members`, { replace: true })
</script>

<template>
  <div />
</template>
