<script setup lang="ts">
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="nc-notification-avatar"></div>
    <div class="flex-grow ml-4">
      <div class="flex items-center">
        <div class="text-xs">Welcome to NocoHUB! We’re excited to have you onboard.</div>
      </div>
      <div class="text-xs text-gray-500">1 hour ago - NocoHUB</div>
    </div>
    <div class="self-start">
      <a-checkbox class="!my-0"></a-checkbox>
    </div>
  </div>
</template>

<style scoped>
.nc-notification-avatar {
  @apply w-12 h-12 rounded-full text-white font-weight-bold uppercase bg-gray-100;
  font-size: 0.7rem;
}
</style>
