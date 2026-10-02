<script setup lang="ts">
// Legacy route — the pane lives on the workspace settings page now.
definePageMeta({
  middleware: [
    (to) => navigateTo({ path: wsSettingsPath(to.params.typeOrId as string, 'members'), query: to.query }, { replace: true }),
  ],
})
</script>

<template>
  <div class="h-full" />
</template>
