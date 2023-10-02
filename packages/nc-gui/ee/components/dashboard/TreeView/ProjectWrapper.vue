<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { ProjectInj, ProjectRoleInj, ProjectStarredModeInj } from '#imports'

const props = defineProps<{
  baseRole: string | string[]
  base: BaseType
  starredMode?: boolean
}>()

const baseRole = toRef(props, 'baseRole')
const base = toRef(props, 'base')
const starredMode = toRef(props, 'starredMode')

provide(ProjectRoleInj, baseRole)
provide(ProjectInj, base)
provide(ProjectStarredModeInj, starredMode)
</script>

<template>
  <slot />
</template>
