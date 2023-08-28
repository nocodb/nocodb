<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

const props = defineProps<{
  workspace: WorkspaceType
  hideLabel?: boolean
  size?: 'small' | 'medium'
}>()

const workspaceColor = computed(() => props.workspace.meta?.color || stringToColour(props.workspace.id!))

const size = computed(() => props.size || 'medium')
</script>

<template>
  <div
    class="flex nc-workspace-avatar"
    :class="{
      'w-4 h-4': size === 'small',
      'w-6 h-6': size === 'medium',
    }"
    :style="{ backgroundColor: workspaceColor }"
  >
    <template v-if="!props.hideLabel">
      {{ props.workspace?.title?.slice(0, 2) }}
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-avatar {
  @apply min-w-4 rounded text-xs flex items-center justify-center text-white uppercase;
}
</style>
