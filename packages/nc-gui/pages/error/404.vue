<script lang="ts" setup>
import { definePageMeta } from '#imports'

definePageMeta({
  requiresAuth: false,
  public: true,
})
</script>

<template>
  <div class="w-full h-[300px] flex justify-center items-center text-4xl">
    <div class="text-gray-400 flex gap-2 items-center">
      <MdiWarning />
      Page Not Found
    </div>
  </div>
</template>
