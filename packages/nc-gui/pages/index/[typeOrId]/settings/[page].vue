<script setup lang="ts">
// Legacy `/{ws}/settings/{page}` deep link — hands over to the settings overlay.
definePageMeta({
  middleware: [
    (to) =>
      navigateTo(
        {
          path: `/${to.params.typeOrId}`,
          query: { ...to.query, wsSettings: resolveWsSettingsSlug(to.params.page) ?? 'general' },
        },
        { replace: true },
      ),
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
