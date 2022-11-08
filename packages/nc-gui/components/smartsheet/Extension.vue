<script lang="ts" setup>
import { onMounted, ref } from '#imports'

defineProps<{ id: string }>()

const demoExtensionConfig = {
  // should point to some file that exports the extension; When running with vite, don't point to the index.html file but to the actual entry point file
  url: 'http://127.0.0.1:5173/src/index.ts',
  // some id to identify the extension
  id: 'hello-world',
}

const el = ref<HTMLDivElement>()

onMounted(async () => {
  // todo: use fetch instead of import to avoid vite from bundling the extension (?)
  const extension = (await import(demoExtensionConfig.url)).default
  extension(el.value, 'Hello World from NocoDB!')
})
</script>

<template>
  <div ref="el" class="w-full h-full"></div>
</template>
