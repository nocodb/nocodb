<script lang="ts" setup>
import { useSidebar } from '#imports'
definePageMeta({
  hideHeader: true,
})
useSidebar('nc-left-sidebar', { hasSidebar: false })
</script>

<template>
  <NuxtPage :transition="false" />
</template>
