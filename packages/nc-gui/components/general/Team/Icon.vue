<script lang="ts" setup>
import { IconType, type TeamV3V3Type } from 'nocodb-sdk'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { Icon } from '@iconify/vue'
import { isColorDark, stringToColor, type IconMapKey } from '#imports'

export interface TeamIconProps {
  size?: 'small' | 'medium' | 'base' | 'large' | 'xlarge' | 'auto'
  team?: Partial<TeamV3V3Type> | null
  disabled?: boolean
  iconBgColor?: string
  showPlaceholderIcon?: boolean
  isDeleted?: boolean
  initialsLength?: 1 | 2
  placeholderIcon?: IconMapKey
  wrapperClass?: string
}

const props = withDefaults(defineProps<TeamIconProps>(), {
  user: () => ({}),
  size: 'medium',
  disabled: false,
  iconBgColor: '#F4F4F5',
  showPlaceholderIcon: false,
  isDeleted: false,
  initialsLength: 2,
  placeholderIcon: 'ncUsers',
  wrapperClass: '',
})

const { size } = toRefs(props)

const team = computed(() => {
  return {
    ...(props.team || {}),
    title: props.team?.title ?? '',
    icon: props.team?.icon ?? '',
    icon_type: props.team?.icon_type ?? '',
  }
})

const teamIcon = computed<{
  icon: any
  iconType: IconType | string
}>(() => {
  if (props.isDeleted) {
    return {
      icon: 'ncSlash',
      iconType: IconType.ICON,
    }
  }

  const icon = team.value.icon || ''
  const iconType = team.value.icon_type || ''

  // if ((!icon || !iconType) && props.placeholderIcon) {
  //   return {
  //     icon: props.placeholderIcon,
  //     iconType: IconType.ICON,
  //   }
  // }

  if (!icon || !iconType) {
    return {
      icon: '',
      iconType: '',
    }
  }

  return {
    icon,
    iconType,
  }
})

const backgroundColor = computed(() => {
  if (props.iconBgColor === 'transparent') {
    return 'transparent'
  }

  if (props.disabled || props.isDeleted) {
    return '#bbbbbb'
  }

  // in comments we need to generate user icon from email
  const color = team.value.title ? stringToColor(team.value.title) : '#FFFFFF'

  if (teamIcon.value.icon) {
    switch (teamIcon.value.iconType) {
      case IconType.EMOJI: {
        return props.iconBgColor
      }
      case IconType.ICON: {
        return props.iconBgColor
      }

      default: {
        return color || '#FFFFFF'
      }
    }
  }

  return color || '#FFFFFF'
})

const teamInitials = computed(() => {
  if (props.disabled || props.isDeleted || !team.value.title) {
    return ''
  }

  const displayNameSplit = team.value.title?.split(' ').filter((name) => name) ?? []

  if (displayNameSplit.length > 0) {
    if (displayNameSplit.length > 1) {
      return displayNameSplit[0][0] + displayNameSplit[1][0]
    } else {
      return team.value.title.slice(0, props.initialsLength)
    }
  }
})
</script>

<template>
  <div
    class="nc-team-avatar"
    :class="[
      {
        'h-full min-h-5 aspect-square': size === 'auto',
        'w-4 h-4': size === 'small',
        'w-6 h-6': size === 'medium',
        'w-8 h-8': size === 'base',
        'w-20 h-20': size === 'large',
        'w-26 h-26': size === 'xlarge',
      },
      wrapperClass,
    ]"
    :style="{
      backgroundColor: backgroundColor,
    }"
  >
    <div
      v-if="teamIcon.icon && teamIcon.iconType === IconType.EMOJI"
      class="flex items-center justify-center align-middle"
      :class="{
        'text-inherit': size === 'auto',
        'text-white': isColorDark(backgroundColor),
        'text-black opacity-80': !isColorDark(backgroundColor),
        'text-tiny': size === 'small',
        'text-base': size === 'medium',
        'text-lg': size === 'base',
        'text-4xl': size === 'large',
        'text-5xl': size === 'xlarge',
      }"
    >
      <div v-if="isUnicodeEmoji(teamIcon.icon)">
        {{ teamIcon.icon }}
      </div>

      <Icon
        v-else
        :data-testid="`nc-icon-${teamIcon.icon}`"
        class="!text-inherit flex-none"
        :class="{
          'w-[75%] h-[75%]': size === 'auto',
          'w-3 h-3': size === 'small',
          'w-4 h-4': size === 'medium',
          'w-5 h-5': size === 'base',
          'w-12 h-12': size === 'large',
          'w-14 h-14': size === 'xlarge',
        }"
        :icon="teamIcon.icon"
      ></Icon>
    </div>
    <GeneralIcon
      v-else-if="teamIcon.icon && teamIcon.iconType === IconType.ICON"
      :icon="teamIcon.icon"
      class="flex-none"
      :class="{
        'w-[75%] h-[75%]': size === 'auto',
        'text-white': isColorDark(backgroundColor),
        'text-black opacity-80': !isColorDark(backgroundColor),
        'w-3 h-3': size === 'small',
        'w-4 h-4': size === 'medium',
        'w-5 h-5': size === 'base',
        'w-12 h-12': size === 'large',
        'w-14 h-14': size === 'xlarge',
        '!opacity-50': isDeleted,
      }"
    />
    <div
      v-else-if="teamInitials"
      class="font-semibold"
      :class="{
        '!text-md': size === 'base',
        '!text-3xl': size === 'large',
        '!text-4xl': size === 'xlarge',
        'text-white': isColorDark(backgroundColor),
        'text-black': !isColorDark(backgroundColor),
      }"
    >
      {{ teamInitials }}
    </div>
    <div v-else>&nbsp;</div>
  </div>
</template>

<style lang="scss" scoped>
.nc-team-avatar {
  @apply flex-none rounded-lg text-xs flex items-center justify-center uppercase overflow-hidden;
}
</style>
