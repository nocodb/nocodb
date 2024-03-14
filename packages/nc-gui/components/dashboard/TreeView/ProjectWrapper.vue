<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { ProjectInj, ProjectRoleInj } from '#imports'

const props = withDefaults(
  defineProps<{
    baseRole: string | string[]
    base: BaseType
  }>(),
  {
    baseRole: '',
  },
)

const baseRole = toRef(props, 'baseRole')
const base = toRef(props, 'base')

provide(ProjectRoleInj, baseRole)
provide(ProjectInj, base)
</script>

<template>
  <slot />
</template>
