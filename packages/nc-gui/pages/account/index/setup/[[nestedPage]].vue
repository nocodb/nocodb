<script setup lang="ts">
const { loadSetupApps } = useProvideAccountSetupStore()

const $route = useRoute()

onMounted(async () => {
  await loadSetupApps()
})

const { categorizeApps } = useAccountSetupStoreOrThrow()

const activeAppId = computed(
  () => categorizeApps.value?.[$route.params.nestedPage?.toLowerCase()]?.find((app) => app.title === $route.params.app)?.id,
)
</script>

<template>
  <div class="h-full">
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
