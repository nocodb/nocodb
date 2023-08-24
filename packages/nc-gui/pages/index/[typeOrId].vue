<script lang="ts" setup>
const router = useRouter()

const route = router.currentRoute
</script>

<template>
  <div>
    <NuxtPage :transition="false" :page-key="route.params.typeOrId" />
  </div>
</template>
