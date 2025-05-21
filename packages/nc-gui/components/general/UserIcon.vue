<script lang="ts" setup>
import { IconType, type UserType } from 'nocodb-sdk'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { Icon } from '@iconify/vue'
import { isColorDark, stringToColor } from '#imports'

const props = withDefaults(
  defineProps<{
    size?: 'small' | 'medium' | 'base' | 'large' | 'xlarge' | 'auto'
    user?: Partial<UserType> | Partial<User> | null
    disabled?: boolean
    iconBgColor?: string
  }>(),
  {
    user: () => ({}),
    size: 'medium',
    name: '',
    email: '',
    disabled: false,
    iconBgColor: '#F4F4F5',
  },
)

const { size } = toRefs(props)

const { getPossibleAttachmentSrc } = useAttachment()

const user = computed(() => {
  return {
    ...(props.user || {}),
    email: props.user?.email?.trim() || '',
    display_name: props.user?.display_name?.trim() || '',
    meta: props.user?.meta || null,
  }
})

const userIcon = computed<{
  icon: any
  iconType: IconType | string
}>(() => {
  if (!user.value.meta) {
    return {
      icon: '',
      iconType: '',
    }
  }

  const icon = parseProp(user.value.meta).icon || ''
  const iconType = parseProp(user.value.meta).iconType || ''

  return {
    icon: iconType === IconType.IMAGE && ncIsObject(icon) ? getPossibleAttachmentSrc(icon) || '' : (icon as string),
    iconType,
  }
})

const backgroundColor = computed(() => {
  if (props.disabled) {
    return '#bbbbbb'
  }

  // in comments we need to generate user icon from email
  const color = user.value.display_name
    ? stringToColor(user.value.display_name)
    : user.value.email
    ? stringToColor(user.value.email)
    : '#FFFFFF'

  if (userIcon.value.icon) {
    switch (userIcon.value.iconType) {
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
        return color || '#FFFFFF'
      }
    }
  }

  return color || '#FFFFFF'
})

const usernameInitials = computed(() => {
  if (props.disabled) {
    return ''
  }

  const displayNameSplit = user.value.display_name?.split(' ').filter((name) => name) ?? []

  if (displayNameSplit.length > 0) {
    if (displayNameSplit.length > 1) {
      return displayNameSplit[0][0] + displayNameSplit[1][0]
    } else {
      return user.value.display_name.slice(0, 2)
    }
  } else {
    return user.value.email?.split('@')[0].slice(0, 2)
  }
})
</script>

<template>
  <div
    class="nc-user-avatar"
    :class="{
      'h-full min-h-5 aspect-square': size === 'auto',
      'w-4 h-4': size === 'small',
      'w-6 h-6': size === 'medium',
      'w-8 h-8': size === 'base',
      'w-20 h-20': size === 'large',
      'w-26 h-26': size === 'xlarge',
    }"
    :style="{
      backgroundColor: userIcon.icon && userIcon.iconType === IconType.IMAGE ? undefined : backgroundColor,
    }"
  >
    <CellAttachmentPreviewImage
      v-if="userIcon.icon && userIcon.iconType === IconType.IMAGE"
      :srcs="userIcon.icon"
      class="flex-none !object-contain max-h-full max-w-full !m-0"
    />

    <div
      v-else-if="userIcon.icon && userIcon.iconType === IconType.EMOJI"
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
      <div v-if="isUnicodeEmoji(userIcon.icon)">
        {{ userIcon.icon }}
      </div>

      <Icon
        v-else
        :data-testid="`nc-icon-${userIcon.icon}`"
        class="!text-inherit flex-none"
        :class="{
          'w-[75%] h-[75%]': size === 'auto',
          'w-3 h-3': size === 'small',
          'w-4 h-4': size === 'medium',
          'w-5 h-5': size === 'base',
          'w-12 h-12': size === 'large',
          'w-14 h-14': size === 'xlarge',
        }"
        :icon="userIcon.icon"
      ></Icon>
    </div>
    <GeneralIcon
      v-else-if="userIcon.icon && userIcon.iconType === IconType.ICON"
      :icon="userIcon.icon"
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
      }"
    />
    <div
      v-else-if="usernameInitials"
      class="font-semibold"
      :class="{
        '!text-md': size === 'base',
        '!text-3xl': size === 'large',
        '!text-4xl': size === 'xlarge',
        'text-white': isColorDark(backgroundColor),
        'text-black': !isColorDark(backgroundColor),
      }"
    >
      {{ usernameInitials }}
    </div>
    <div v-else>&nbsp;</div>
  </div>
</template>

<style lang="scss" scoped>
.nc-user-avatar {
  @apply flex-none rounded-full text-xs flex items-center justify-center uppercase overflow-hidden;
}
</style>
