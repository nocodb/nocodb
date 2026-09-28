<script setup lang="ts">
// Legacy deep link. Base settings is a `?settings=` overlay now, so this path
// hands over to the base root with the shell open rather than being a page.
definePageMeta({
  middleware: [
    (to) =>
      navigateTo(
        {
          path: `/${to.params.typeOrId}/${to.params.baseId}`,
          query: { ...to.query, settings: 'members' },
        },
        { replace: true },
      ),
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
