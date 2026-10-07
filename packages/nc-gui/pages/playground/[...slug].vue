<script setup lang="ts">
/** Unknown /playground/* paths land here instead of falling through to the /:typeOrId workspace route. */
const route = useRoute()
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center gap-3 p-8 text-center" data-testid="nc-playground-not-found">
    <div class="w-10 h-10 rounded-lg bg-nc-bg-gray-light flex items-center justify-center">
      <GeneralIcon icon="ncSearch" class="w-5 h-5 text-nc-content-gray-muted" />
    </div>
    <h1 class="text-subHeading2 text-nc-content-gray-emphasis">Page not found</h1>
    <p class="text-body text-nc-content-gray-subtle max-w-md">
      There's no playground page at <code class="font-mono text-captionSm">{{ route.path }}</code
      >.
    </p>
    <NuxtLink to="/playground" class="!no-underline">
      <NcButton size="small" type="secondary">Back to playground</NcButton>
    </NuxtLink>
  </div>
</template>
