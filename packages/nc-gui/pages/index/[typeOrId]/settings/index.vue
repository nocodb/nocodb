<script setup lang="ts">
// Legacy route. Workspace settings is a `?wsSettings=` overlay now; the General
// page's `?tab=` sections are rail rows of their own.
definePageMeta({
  middleware: [
    (to) => {
      const { tab, ...query } = to.query

      return navigateTo(
        { path: `/${to.params.typeOrId}`, query: { ...query, wsSettings: resolveWsSettingsSlug(tab) ?? 'general' } },
        { replace: true },
      )
    },
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
