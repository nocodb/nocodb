<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { ProjectInj, ProjectRoleInj, ProjectStarredModeInj } from '#imports'

const props = defineProps<{
  projectRole: string | string[]
  project: ProjectType
  starredMode?: boolean
}>()

const projectRole = toRef(props, 'projectRole')
const project = toRef(props, 'project')
const starredMode = toRef(props, 'starredMode')

provide(ProjectRoleInj, projectRole)
provide(ProjectInj, project)
provide(ProjectStarredModeInj, starredMode)
</script>

<template>
  <slot />
</template>
