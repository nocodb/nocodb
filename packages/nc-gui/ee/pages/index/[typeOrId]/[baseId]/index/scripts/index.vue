<script setup lang="ts">
const route = useRoute()
const router = useRouter()

router.replace({
  name: 'index-typeOrId-baseId-index',
  params: {
    typeOrId: route.params.typeOrId,
    baseId: route.params.baseId,
  },
})
</script>

<template>
  <NcSpanHidden />
</template>
