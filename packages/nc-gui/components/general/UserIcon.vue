<script lang="ts" setup>
const props = defineProps<{
  size?: 'small' | 'medium' | 'base' | 'large' | 'xlarge'
  name?: string
}>()

const { user } = useGlobal()

const backgroundColor = computed(() => (user.value?.id ? stringToColour(user.value?.id) : '#FFFFFF'))

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
