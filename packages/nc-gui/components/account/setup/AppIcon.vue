<script setup lang="ts">
defineProps<{
  app: {
    title: string
    logo: string
    icon?: string
  }
}>()
</script>

<template>
  <GeneralIcon v-if="app.icon" class="text-nc-content-gray-subtle" :icon="app.icon as IconMapKey" />
  <img v-else class="object-contain" :alt="app.title" :src="app.logo" />
</template>
