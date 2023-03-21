<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { ProjectInj, ProjectRoleInj } from '#imports'

const props = defineProps<{
  projectRole: string | string[]
  project: ProjectType
}>()

const projectRole = toRef(props, 'projectRole')
const project = toRef(props, 'project')

provide(ProjectRoleInj, projectRole)
provide(ProjectInj, project)
</script>

<template>
  <slot />
</template>
