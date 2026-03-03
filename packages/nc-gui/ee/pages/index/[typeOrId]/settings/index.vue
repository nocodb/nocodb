<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

// Redirect bare /{wsId}/settings/ to /{wsId}/settings/ws-members
navigateTo(`/${route.params.typeOrId}/settings/ws-members`, { replace: true })
</script>

<template>
  <div />
</template>
