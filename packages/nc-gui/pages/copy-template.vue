<script lang="ts" setup>
const route = useRoute()

const { $api } = useNuxtApp()

const { sharedBaseId, isUseThisTemplate, options, templateName } = useCopySharedBase()

const { forcedProjectId } = storeToRefs(useBase())

const getSharedBaseTitle = async () => {
  if (!route.query.base) return

  try {
    const sharedBaseMeta = await $api.public.sharedBaseGet(route.query.base as string)

    templateName.value = (sharedBaseMeta?.base_title as string) ?? ''
  } catch (e: any) {
    console.error(e)
  }
}

onMounted(async () => {
  isUseThisTemplate.value = true

  options.value.includeData = true
  options.value.includeViews = true

  sharedBaseId.value = route.query.base as string

  if (forcedProjectId?.value) forcedProjectId.value = undefined

  await getSharedBaseTitle()

  navigateTo(`/`)
})
</script>

<template>
  <div></div>
</template>

<style scoped></style>
