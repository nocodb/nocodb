<script setup lang="ts">
import {storeToRefs} from "pinia";

definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { project } = storeToRefs(useProject())
</script>

<template>
  <DocsBookView v-if="project?.id" :key="project?.id" />
</template>
