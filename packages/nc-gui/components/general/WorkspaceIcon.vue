<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { Icon } from '@iconify/vue'
import { WorkspaceIconType, isColorDark, stringToColor } from '#imports'

const props = defineProps<{
  workspace: WorkspaceType | undefined
  workspaceIcon?: {
    icon: string | Record<string, any>
    iconType: WorkspaceIconType | string
  }
  hideLabel?: boolean
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  isRounded?: boolean
}>()

const { workspace } = toRefs(props)

const { getPossibleAttachmentSrc } = useAttachment()

const workspaceIcon = computed(() => {
  if (!workspace.value) {
    return {
      icon: '',
      iconType: '',
    }
  }

  let icon = workspace.value.meta?.icon || ''
  let iconType = workspace.value.meta?.iconType || ''

  if (props.workspaceIcon) {
    icon = props.workspaceIcon?.icon || ''
    iconType = props.workspaceIcon?.iconType || ''
  }

  return {
    icon: iconType === WorkspaceIconType.IMAGE && ncIsObject(icon) ? getPossibleAttachmentSrc(icon) || '' : icon,
    iconType,
  }
})

const workspaceColor = computed(() => {
  const color = workspace.value ? workspace.value.meta?.color || stringToColor(workspace.value.id!) : undefined

  if (!props.hideLabel && workspaceIcon.value.icon) {
    switch (workspaceIcon.value.iconType) {
      case WorkspaceIconType.IMAGE: {
        return ''
      }
      case WorkspaceIconType.EMOJI: {
        return '#F4F4F5'
      }
      case WorkspaceIconType.ICON: {
        return '#F4F4F5'
      }

      default: {
        return color || '#0A1433'
      }
    }
  }

  return color || '#0A1433'
})

const size = computed(() => props.size || 'medium')
</script>

<template>
  <div
    class="flex nc-workspace-avatar overflow-hidden"
    :class="{
      'min-w-4 w-4 h-4 rounded': size === 'small',
      'min-w-6 w-6 h-6 rounded-md': size === 'medium',
      'min-w-10 w-10 h-10 rounded-lg !text-base': size === 'large',
      'min-w-16 w-16 h-16 rounded-lg !text-4xl': size === 'xlarge',
      '!rounded-[50%]': props.isRounded,
    }"
    :style="{
      backgroundColor:
        !props.hideLabel && workspaceIcon.icon && workspaceIcon.iconType === WorkspaceIconType.IMAGE ? undefined : workspaceColor,
    }"
  >
    <template v-if="!props.hideLabel">
      <CellAttachmentPreviewImage
        v-if="workspaceIcon.icon && workspaceIcon.iconType === WorkspaceIconType.IMAGE"
        :srcs="workspaceIcon.icon"
        class="flex-none !object-contain max-h-full max-w-full !m-0"
      />
      <div
        v-else-if="workspaceIcon.icon && workspaceIcon.iconType === WorkspaceIconType.EMOJI"
        class="flex items-center justify-center"
        :class="{
          'text-white': isColorDark(workspaceColor),
          'text-black opacity-80': !isColorDark(workspaceColor),
          'text-sm': size === 'small',
          'text-base': size === 'medium',
          'text-2xl': size === 'large',
          'text-4xl': size === 'xlarge',
        }"
      >
        <template v-if="isUnicodeEmoji(workspaceIcon.icon)">
          {{ workspaceIcon.icon }}
        </template>
        <template v-else>
          <Icon
            :data-testid="`nc-icon-${workspaceIcon.icon}`"
            class="!text-inherit flex-none"
            :class="{
              'w-3 h-3': size === 'small',
              'w-4 h-4': size === 'medium',
              'w-6 h-6': size === 'large',
              'w-10 h-10': size === 'xlarge',
            }"
            :icon="workspaceIcon.icon"
          ></Icon>
        </template>
      </div>
      <GeneralIcon
        v-else-if="workspaceIcon.icon && workspaceIcon.iconType === WorkspaceIconType.ICON"
        :icon="workspaceIcon.icon"
        class="flex-none"
        :class="{
          'text-white': isColorDark(workspaceColor),
          'text-black opacity-80': !isColorDark(workspaceColor),
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
