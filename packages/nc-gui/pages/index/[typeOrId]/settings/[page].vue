<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

// Redirect old /settings/{page} URLs to new flat /{wsId}/{slug}
const slug = route.params.page as string
const wsTab = wsSettingsSlugToTab[slug]
const newSlug = wsTab ? wsSettingsTabToSlug[wsTab] || slug : slug
navigateTo(`/${route.params.typeOrId}/${newSlug}`, { replace: true })
</script>

<template>
  <div />
</template>
