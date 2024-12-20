<script setup lang="ts">
import '~/assets/js/typesense-docsearch'
declare const docsearch: any

const modalEl = ref<HTMLElement | null>(null)
const { user } = useGlobal()

watch(user, () => {
  window.doc_enabled = !!user.value
})

onMounted(() => {
  docsearch({
    container: '#searchbar',
    typesenseCollectionName: 'nocodb-oss-docs-index',
    typesenseServerConfig: {
      nodes: [
        {
          host: 'rqf5uvajyeczwt3xp-1.a1.typesense.net',
          port: 443,
          protocol: 'https',
        },
      ],
      apiKey: 'lNKDTZdJrE76Sg8WEyeN9mXT29l1xq7Q',
    },
    typesenseSearchParameters: {
      // Optional.
    },
  })
})
</script>

<template>
  <div id="searchbar" :ref="modalEl" class="hidden"></div>
</template>

<style lang="scss"></style>
