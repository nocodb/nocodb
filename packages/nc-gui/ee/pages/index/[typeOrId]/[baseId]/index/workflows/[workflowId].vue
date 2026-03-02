<script setup lang="ts">
const route = useRoute()
const router = useRouter()

router.replace({
  name: 'index-typeOrId-baseId-index-automations-workflows-workflowId',
  params: {
    typeOrId: route.params.typeOrId,
    baseId: route.params.baseId,
    workflowId: route.params.workflowId,
  },
  query: route.query,
})
</script>

<template>
  <NcSpanHidden />
</template>
