<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'
import { isColorDark, stringToColor } from '~/utils/colorsUtils'

const props = defineProps<{
  workspace: WorkspaceType | undefined
  hideLabel?: boolean
  size?: 'small' | 'medium' | 'large'
}>()

const workspaceColor = computed(() => {
  const color = props.workspace ? props.workspace.meta?.color || stringToColor(props.workspace.id!) : undefined

  return color || '#0A1433'
})

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
      <div
        class="font-semibold"
        :class="{
          'text-white': isColorDark(workspaceColor),
          'text-black': !isColorDark(workspaceColor),
        }"
      >
        {{ props.workspace?.title?.slice(0, 2) }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-avatar {
  @apply text-xs flex items-center justify-center text-white uppercase;
}
</style>
