<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const automationId = route.params.automationId as string
const typeOrId = route.params.typeOrId as string
const baseId = route.params.baseId as string

router.replace({
  name: 'index-typeOrId-baseId-index-scripts-scriptId',
  params: {
    typeOrId,
    baseId,
    scriptId: automationId,
  },
  query: route.query,
})
</script>

<template>
  <NcSpanHidden />
</template>
