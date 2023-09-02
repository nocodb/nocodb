<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

const props = defineProps<{
  workspace: WorkspaceType | undefined
  hideLabel?: boolean
  size?: 'small' | 'medium' | 'large'
}>()

const workspaceColor = computed(() =>
  props.workspace ? props.workspace.meta?.color || stringToColour(props.workspace.id!) : undefined,
)

const size = computed(() => props.size || 'medium')
</script>

<template>
  <div
    class="flex nc-workspace-avatar"
    :class="{
      'min-w-4 w-4 h-4 rounded': size === 'small',
      'min-w-6 w-6 h-6 rounded-md': size === 'medium',
      'min-w-10 w-10 h-10 rounded-lg !text-base': size === 'large',
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
  @apply text-xs flex items-center justify-center text-white uppercase;
}
</style>
