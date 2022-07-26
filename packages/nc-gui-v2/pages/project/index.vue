<template>
  <NuxtLayout>
    <div class="w-full nc-container">
      <NuxtPage />
    </div>
  </NuxtLayout>
</template>

<style scoped>
.nc-container {
  @apply h-[calc(100vh_-_var(--header-height))];
}
</style>
