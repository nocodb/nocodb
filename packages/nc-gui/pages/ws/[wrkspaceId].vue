<script lang="ts" setup>
const router = useRouter()
const route = $(router.currentRoute)
</script>

<template>
  <NuxtPage :page-key="route.params.workspaceId" />
</template>
