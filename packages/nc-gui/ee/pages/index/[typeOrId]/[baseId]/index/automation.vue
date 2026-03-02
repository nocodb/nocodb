<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const typeOrId = route.params.typeOrId as string
const baseId = route.params.baseId as string

router.replace({
  name: 'index-typeOrId-baseId-index-automations',
  params: {
    typeOrId,
    baseId,
  },
  query: route.query,
})
</script>

<template>
  <NcSpanHidden />
</template>
