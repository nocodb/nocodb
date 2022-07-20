<template>
  <NuxtLayout>
    <div class="w-full nc-container">
      <NuxtPage />
    </div>
  </NuxtLayout>
</template>

<style scoped>
.nc-container {
  height: calc(100vh - var(--header-height));
}
</style>
