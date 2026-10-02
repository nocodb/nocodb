<script setup lang="ts">
// Legacy route. Workspace settings is a `?wsSettings=` overlay now, so this path
// hands over to the workspace home with the shell open.
definePageMeta({
  middleware: [
    (to) => navigateTo({ path: `/${to.params.typeOrId}`, query: { ...to.query, wsSettings: 'integrations' } }, { replace: true }),
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
