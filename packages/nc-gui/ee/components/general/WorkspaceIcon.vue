<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'
import { isColorDark, stringToColor } from '~/utils/colorsUtils'
import { WorkspaceIconType } from '#imports'

const props = defineProps<{
  workspace: WorkspaceType | undefined
  workspaceIcon?: {
    icon: string
    iconType: WorkspaceIconType | string
  }
  hideLabel?: boolean
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  isRounded?: boolean
}>()

const { workspace } = toRefs(props)

const workspaceColor = computed(() => {
  const color = workspace.value ? workspace.value.meta?.color || stringToColor(workspace.value.id!) : undefined

  return color || '#0A1433'
})

const size = computed(() => props.size || 'medium')

const workspaceIcon = computed(() => {
  if (!workspace.value) {
    return {
      icon: '',
      iconType: '',
    }
  }

  if (props.workspaceIcon?.icon) return props.workspaceIcon

  return {
    icon: workspace.value.meta?.icon || '',
    iconType: workspace.value.meta?.iconType || '',
  }
})

watchEffect(() => {
  console.log('ocon', workspaceIcon.value)
})
</script>

<template>
  <div
    class="flex nc-workspace-avatar"
    :class="{
      'min-w-4 w-4 h-4 rounded': size === 'small',
      'min-w-6 w-6 h-6 rounded-md': size === 'medium',
      'min-w-10 w-10 h-10 rounded-lg !text-base': size === 'large',
      'min-w-16 w-16 h-16 rounded-lg !text-2xl': size === 'xlarge',
      '!rounded-[50%]': props.isRounded,
    }"
    :style="{ backgroundColor: workspaceColor }"
  >
    <template v-if="!props.hideLabel">
      <GeneralIcon
        v-if="workspaceIcon.icon && workspaceIcon.iconType === WorkspaceIconType.ICON"
        :icon="workspaceIcon.icon"
        class="flex-none"
        :class="{
          'text-white': isColorDark(workspaceColor),
          'text-black': !isColorDark(workspaceColor),
          'w-3 h-3': size === 'small',
          'w-4 h-4': size === 'medium',
          'w-6 h-6': size === 'large',
          'w-10 h-10': size === 'xlarge',
        }"
      />
      <div
        v-else
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
