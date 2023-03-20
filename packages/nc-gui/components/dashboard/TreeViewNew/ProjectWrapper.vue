<script lang="ts" setup>
import { ProjectRoleInj } from '#imports'

const props = defineProps<{
  projectRole: string
}>()

const projectRole = toRef(props, 'projectRole')

provide(ProjectRoleInj, projectRole)
</script>

<template>
  <slot />
</template>
