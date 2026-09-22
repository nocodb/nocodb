<script setup lang="ts">
// Legacy deep link. Base settings is a `?settings=` overlay now, so this path
// hands over to the base root with the shell open rather than being a page.
const route = useRoute()

const slug = route.params.page as string

navigateTo(
  {
    path: `/${route.params.typeOrId}/${route.params.baseId}`,
    query: { ...route.query, settings: baseSettingsSlugToTab[slug] ? slug : 'members' },
  },
  { replace: true },
)
</script>

<template>
  <div class="h-full" />
</template>
