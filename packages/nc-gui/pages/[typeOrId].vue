<script lang="ts" setup>
const router = useRouter()

const route = router.currentRoute

const projectsStore = useProjects()

watch(
  () => route.value.params.typeOrId,
  async () => {
    await projectsStore.loadProjects('recent')
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <NuxtPage :page-key="route.params.typeOrId" />
</template>
