<script setup lang="ts">
const route = useRoute()
const router = useRouter()

router.replace({
  name: 'index-typeOrId-baseId-index-automations-scripts-scriptId-slugs',
  params: {
    typeOrId: route.params.typeOrId,
    baseId: route.params.baseId,
    scriptId: route.params.scriptId,
    slugs: route.params.slugs,
  },
  query: route.query,
})
</script>

<template>
  <NcSpanHidden />
</template>
