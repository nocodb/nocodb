<script setup lang="ts">
const route = useRoute()

const disableBaseLayout = $computed(() => {
  return route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form')
})
</script>

<template>
  <NuxtLayout :name="disableBaseLayout ? false : 'base'">
    <NuxtPage />
  </NuxtLayout>
</template>
