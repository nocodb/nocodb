<script setup lang="ts">
definePageMeta({
  // One key for every pane, so switching panes keeps the page (and its rail) mounted.
  key: (route) => `/${route.params.typeOrId}/settings`,
  middleware: [
    (to, from) => {
      // Back returns to the page settings was entered from; a fresh load has none, so it goes home.
      if (!from.matched.length) ncWsSettingsBackRoute().clear()
      else if (!wsSettingsSlugFromRoute(from)) ncWsSettingsBackRoute().set(from.fullPath)

      const slug = resolveWsSettingsSlug(to.params.page)

      // Legacy and unknown slugs land on their canonical path.
      if (slug !== to.params.page) {
        return navigateTo(
          { path: wsSettingsPath(to.params.typeOrId as string, slug ?? 'general'), query: to.query },
          { replace: true },
        )
      }
    },
  ],
})

const route = useRoute()

const tab = computed(() => resolveWsSettingsSlug(route.params.page))
</script>

<template>
  <WorkspaceSettingsShell v-if="tab" :tab="tab" />
</template>
