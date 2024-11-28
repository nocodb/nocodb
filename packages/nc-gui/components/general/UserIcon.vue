<script lang="ts" setup>
import { isColorDark, stringToColor } from '#imports'

const props = withDefaults(
  defineProps<{
    size?: 'small' | 'medium' | 'base' | 'large' | 'xlarge' | 'auto'
    name?: string
    email?: string
    disabled?: boolean
  }>(),
  {
    size: 'medium',
    name: '',
    email: '',
    disabled: false,
  },
)

const { size, email } = toRefs(props)

const displayName = computed(() => props.name?.trim() || '')

const backgroundColor = computed(() => {
  if (props.disabled) {
    return '#bbbbbb'
  }

  // in comments we need to generate user icon from email
  return displayName.value ? stringToColor(displayName.value) : email.value ? stringToColor(email.value) : '#FFFFFF'
})

const usernameInitials = computed(() => {
  if (props.disabled) {
    return ''
  }

  const displayNameSplit = displayName.value?.split(' ').filter((name) => name) ?? []

  if (displayNameSplit.length > 0) {
    if (displayNameSplit.length > 1) {
      return displayNameSplit[0][0] + displayNameSplit[1][0]
    } else {
      return displayName.value.slice(0, 2)
    }
  } else {
    return email.value?.split('@')[0].slice(0, 2)
  }
})
</script>

<template>
  <div
    class="flex nc-user-avatar font-bold"
    :class="{
      'h-full min-h-5 aspect-square': size === 'auto',
      'min-w-4 min-h-4': size === 'small',
      'min-w-6 min-h-6': size === 'medium',
      'w-8 h-8 !text-md': size === 'base',
      'min-w-20 min-h-20 !text-3xl': size === 'large',
      'min-w-26 min-h-26 !text-4xl': size === 'xlarge',
      'text-white': isColorDark(backgroundColor),
      'text-black': !isColorDark(backgroundColor),
    }"
    :style="{ backgroundColor }"
  >
    {{ usernameInitials }}
  </div>
</template>

<style lang="scss" scoped>
.nc-user-avatar {
  @apply rounded-full text-xs flex items-center justify-center uppercase;
}
</style>
