<script lang="ts" setup>
import { IconType, type WorkspaceType } from 'nocodb-sdk'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { Icon } from '@iconify/vue'
import { isColorDark, stringToColor } from '#imports'

const props = withDefaults(
  defineProps<{
    workspace: Partial<WorkspaceType> | undefined
    workspaceIcon?: {
      icon: string | Record<string, any>
      iconType: IconType | string
    }
    hideLabel?: boolean
    size?: 'small' | 'medium' | 'large' | 'xlarge' | 'middle' | 'account-sidebar' | 'mini-sidebar'
    isRounded?: boolean
    iconBgColor?: string
    showNocodbIcon?: boolean
  }>(),
  {
    iconBgColor: '#F4F4F5',
    showNocodbIcon: false,
  },
)

const { workspace } = toRefs(props)

const { getPossibleAttachmentSrc } = useAttachment()

const { blockWsImageLogoUpload } = useEeConfig()

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
    icon: iconType === IconType.IMAGE && ncIsObject(icon) ? getPossibleAttachmentSrc(icon) || '' : icon,
    iconType,
  }
})

const workspaceColor = computed(() => {
  const color = workspace.value ? workspace.value.meta?.color || stringToColor(workspace.value.id!) : undefined

  if (!props.hideLabel && workspaceIcon.value.icon) {
    switch (workspaceIcon.value.iconType) {
      case IconType.IMAGE: {
        return ''
      }
      case IconType.EMOJI: {
        return props.iconBgColor
      }
      case IconType.ICON: {
        return props.iconBgColor
      }

      default: {
        return props.showNocodbIcon && blockWsImageLogoUpload.value ? undefined : color || '#0A1433'
      }
    }
  }

  return props.showNocodbIcon && blockWsImageLogoUpload.value ? undefined : color || '#0A1433'
})

const size = computed(() => props.size || 'medium')

const isMiniSidebarSize = computed(() => size.value === 'mini-sidebar')
</script>

<template>
  <div
    class="flex nc-workspace-avatar overflow-hidden"
    :class="{
      'min-w-4 w-4 h-4 rounded': size === 'small',
      'min-w-6 w-6 h-6 rounded-md': size === 'medium',
      'min-w-8 w-6 h-8 rounded-md': size === 'middle',
      'min-w-10 w-10 h-10 rounded-lg !text-base': size === 'large',
      'min-w-16 w-16 h-16 rounded-lg !text-4xl': size === 'xlarge',
      'w-5 h-5 min-w-5 rounded min-h-5': size === 'account-sidebar',
      'w-7 h-7 min-w-7 min-h-7 rounded-md': isMiniSidebarSize,
      '!rounded-[50%]': props.isRounded,
    }"
    :style="{
      backgroundColor:
        !props.hideLabel && workspaceIcon.icon && workspaceIcon.iconType === IconType.IMAGE && !isMiniSidebarSize
          ? undefined
          : workspaceColor,
    }"
  >
    <template v-if="!props.hideLabel">
      <CellAttachmentPreviewImage
        v-if="workspaceIcon.icon && workspaceIcon.iconType === IconType.IMAGE"
        :srcs="workspaceIcon.icon"
        class="flex-none !object-contain max-h-full max-w-full !m-0"
        :is-cell-preview="false"
      />
      <div
        v-else-if="workspaceIcon.icon && workspaceIcon.iconType === IconType.EMOJI"
        class="flex items-center justify-center"
        :class="{
          'text-white': isColorDark(workspaceColor),
          'text-black opacity-80': !isColorDark(workspaceColor),
          'text-sm': size === 'small' || size === 'account-sidebar' || isMiniSidebarSize,
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
              'w-4 h-4': size === 'medium' || isMiniSidebarSize,
              'w-6 h-6': size === 'large',
              'w-10 h-10': size === 'xlarge',
            }"
            :icon="workspaceIcon.icon"
          ></Icon>
        </template>
      </div>
      <GeneralIcon
        v-else-if="workspaceIcon.icon && workspaceIcon.iconType === IconType.ICON"
        :icon="workspaceIcon.icon"
        class="flex-none"
        :class="{
          'text-white': isColorDark(workspaceColor),
          'text-black opacity-80': !isColorDark(workspaceColor),
          'w-3 h-3': size === 'small',
          'w-4 h-4': size === 'medium' || isMiniSidebarSize,
          'w-6 h-6': size === 'large',
          'w-10 h-10': size === 'xlarge',
        }"
      />
      <template v-else>
        <div v-if="props.showNocodbIcon && blockWsImageLogoUpload" class="h-full w-full p-0.25">
          <GeneralIcon icon="nocodb1" class="!h-full !w-full" />
        </div>
        <div
          v-else
          class="font-semibold"
          :class="{
            'text-white': isColorDark(workspaceColor),
            'text-black': !isColorDark(workspaceColor),
            'text-[8px]': size === 'small',
            'text-sm': size === 'account-sidebar' || isMiniSidebarSize,
          }"
        >
          {{ workspace?.title?.slice(0, size === 'account-sidebar' || isMiniSidebarSize ? 1 : 2) }}
        </div>
      </template>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-avatar {
  @apply text-xs flex items-center justify-center text-white uppercase;
}
</style>
