<script setup lang="ts">
const { categorizeApps, loadSetupApps } = useAccountSetupStoreOrThrow()

const $route = useRoute()

onMounted(async () => {
  await loadSetupApps()
})

const activeAppId = computed(
  () => categorizeApps.value?.[$route.params.nestedPage?.toLowerCase()]?.find((app) => app.title === $route.params.app)?.id,
)
</script>

<template>
  <div class="h-full" data-testid="nc-setup">
    <template v-if="$route.params.app">
      <LazyAccountSetupConfig v-if="activeAppId" :id="activeAppId" />
    </template>
    <template v-else-if="$route.params.nestedPage?.toLowerCase() === 'storage'">
      <LazyAccountSetupList category="Storage" />
    </template>
    <template v-else-if="$route.params.nestedPage?.toLowerCase() === 'email'">
      <LazyAccountSetupList category="Email" />
    </template>
    <template v-else>
      <LazyAccountSetup />
    </template>
  </div>
</template>
