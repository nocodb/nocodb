<script setup lang="ts">
// The old General page's `?tab=` sections are panes of their own now.
definePageMeta({
  middleware: [
    (to) => {
      const { tab, ...query } = to.query

      return navigateTo(
        { path: wsSettingsPath(to.params.typeOrId as string, resolveWsSettingsSlug(tab) ?? 'general'), query },
        { replace: true },
      )
    },
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
