<script lang="ts" setup>
import { useBase, useCopySharedBase, useRoute } from '#imports'

const route = useRoute()

const { sharedBaseId } = useCopySharedBase()

const { forcedProjectId } = storeToRefs(useBase())

onMounted(() => {
  sharedBaseId.value = route.query.base as string
  if (forcedProjectId?.value) forcedProjectId.value = undefined
  navigateTo(`/`)
})
</script>

<template>
  <div></div>
</template>

<style scoped></style>
