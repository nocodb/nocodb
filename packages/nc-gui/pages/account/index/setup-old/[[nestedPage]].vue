<script setup lang="ts">
const { loadSetupApps } = useProvideAccountSetupStore()

onMounted(async () => {
  await loadSetupApps()
})
</script>

<template>
  <div class="h-full">
    <template v-if="$route.params.nestedPage === 'storage'">
      <LazyAccountSetupListModal category="Storage" />
    </template>
    <template v-else-if="$route.params.nestedPage === 'email'">
      <LazyAccountSetupListModal category="Email"  />
    </template>
    <template v-else>
      <LazyAccountSetup />
    </template>
  </div>
</template>
