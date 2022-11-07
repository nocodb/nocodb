<script lang="ts" setup>
import { useProject } from '#imports'

const props = defineProps<{ id: string }>()

const { project } = useProject()

const extension = (await import(`../../extensions/${props.id}/index.ts`)).default
</script>

<template>
  <component :is="extension(project.title)" />
</template>
