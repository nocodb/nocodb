<script setup lang="ts">
import RealtimeDebug from '~/components/realtime/Debug.vue'

// Set meta info for the page
definePageMeta({
  title: 'Realtime Debug Console',
})
</script>

<template>
  <NuxtLayout name="default">
    <RealtimeDebug />
  </NuxtLayout>
</template>
