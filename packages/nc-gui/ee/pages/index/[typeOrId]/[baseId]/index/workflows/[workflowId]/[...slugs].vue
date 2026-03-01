<script setup lang="ts">
const route = useRoute()
const router = useRouter()

router.replace({
  name: 'index-typeOrId-baseId-index-automation-workflows-workflowId-slugs',
  params: {
    typeOrId: route.params.typeOrId,
    baseId: route.params.baseId,
    workflowId: route.params.workflowId,
    slugs: route.params.slugs,
  },
  query: route.query,
})
</script>

<template>
  <NcSpanHidden />
</template>
