<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onMounted } from '#imports'

const root = ref<HTMLDivElement>()

onMounted(() => {
  if (root.value)
    monaco.editor.create(root?.value, {
      value: 'console.log("Hello, world")',
      language: 'json',
    })
})
</script>

<template>
  <div ref="root"></div>
</template>

<style scoped></style>
