<script lang="ts" setup>
definePageMeta({
  requiresAuth: false,
  public: true,
})
</script>

<template>
  <div class="bg-primary bg-opacity-5 w-full h-full flex flex-col justify-center items-center text-4xl gap-12">
    <div class="text-gray-400 flex gap-4 items-center">
      <component :is="iconMap.warning" />
      Page Not Found
    </div>
  </div>
</template>
