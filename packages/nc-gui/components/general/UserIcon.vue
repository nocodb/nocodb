<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    size?: 'small' | 'medium' | 'base' | 'large' | 'xlarge'
    name?: string
    email?: string
  }>(),
  {
    email: '',
  },
)

const { user } = useGlobal()

const emailProp = toRef(props, 'email')

const backgroundColor = computed(() => {
  // in comments we need to generate user icon from email
  if (emailProp.value.length) {
    return stringToColour(emailProp.value)
  }

  return user.value?.email ? stringToColour(user.value?.email) : '#FFFFFF'
})

const size = computed(() => props.size || 'medium')

const displayName = computed(() => props.name ?? user.value?.display_name ?? '')

const email = computed(() => props.name ?? user.value?.email ?? '')

const usernameInitials = computed(() => {
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
    class="flex nc-user-avatar"
    :class="{
      'min-w-4 min-h-4': size === 'small',
      'min-w-6 min-h-6': size === 'medium',
      'w-8 h-8 !text-md': size === 'base',
      'min-w-20 min-h-20 !text-3xl': size === 'large',
      'min-w-26 min-h-26 !text-4xl': size === 'xlarge',
    }"
    :style="{ backgroundColor }"
  >
    {{ usernameInitials }}
  </div>
</template>

<style lang="scss" scoped>
.nc-user-avatar {
  @apply rounded-full text-xs flex items-center justify-center text-white uppercase;
}
</style>
