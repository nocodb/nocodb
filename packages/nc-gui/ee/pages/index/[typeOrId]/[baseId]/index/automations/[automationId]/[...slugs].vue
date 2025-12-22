<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const automationId = route.params.automationId as string
const typeOrId = route.params.typeOrId as string
const baseId = route.params.baseId as string
const slugs = route.params.slugs as string[]

router.replace({
  name: 'index-typeOrId-baseId-index-scripts-scriptId-slugs',
  params: {
    typeOrId,
    baseId,
    scriptId: automationId,
    slugs,
  },
  query: route.query,
})
</script>

<template>
  <NcSpanHidden />
</template>
