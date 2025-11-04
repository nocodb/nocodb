<script lang="ts" setup>
const route = useRoute()

const { sharedBaseId, isUseThisTemplate, options } = useCopySharedBase()

const { forcedProjectId } = storeToRefs(useBase())

onMounted(() => {
  isUseThisTemplate.value = true

  options.value.includeData = true
  options.value.includeViews = true

  sharedBaseId.value = route.query.base as string

  if (forcedProjectId?.value) forcedProjectId.value = undefined

  navigateTo(`/`)
})
</script>

<template>
  <div></div>
</template>

<style scoped></style>
