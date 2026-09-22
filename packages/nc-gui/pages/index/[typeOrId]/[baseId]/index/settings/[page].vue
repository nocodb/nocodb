<script setup lang="ts">
// Legacy deep link. Base settings is a `?settings=` overlay now, so this path
// hands over to the base root with the shell open rather than being a page.
//
// A middleware, not `setup`: the shell can replace the query again the moment it
// mounts (the old General slug forwards to whichever row replaced it), and a
// second replace racing the navigation that is still landing leaves the address
// bar on this path while the modal shows the right pane.
definePageMeta({
  middleware: [
    (to) => {
      const slug = to.params.page as string

      return navigateTo(
        {
          path: `/${to.params.typeOrId}/${to.params.baseId}`,
          query: { ...to.query, settings: baseSettingsSlugToTab[slug] ? slug : 'members' },
        },
        { replace: true },
      )
    },
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
