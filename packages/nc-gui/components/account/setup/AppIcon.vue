<script setup lang="ts">
defineProps<{
  app: {
    title: string
    logo: string
  }
}>()
</script>

<template>
  <img v-if="app.title !== 'SMTP'" class="object-contain" :alt="app.title" :src="app.logo" />
  <GeneralIcon v-else class="text-gray-500" icon="mail" />
</template>
