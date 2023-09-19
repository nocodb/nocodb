<script lang="ts" setup>
const props = defineProps<{
  size?: 'small' | 'medium' | 'large' | 'xlarge'
}>()

const { currentUser } = storeToRefs(useUsers())

const backgroundColor = computed(() => (currentUser.value?.id ? stringToColour(currentUser.value?.id) : '#FFFFFF'))

const size = computed(() => props.size || 'medium')

const displayName = computed(() => currentUser.value?.display_name ?? '')

const email = computed(() => currentUser.value?.email ?? '')

const usernameInitials = computed(() => {
  if (displayName.value) {
    const displayNameSplit = displayName.value.split(' ')
    if (displayNameSplit.length > 1) {
      return displayNameSplit[0][0] + displayNameSplit[1][0]
    } else {
      return displayName.value[0] + displayName.value[1]
    }
  } else {
    return email.value[0] + email.value[1]
  }
})
</script>

<template>
  <div
    class="flex nc-user-avatar"
    :class="{
      'min-w-4 min-h-4': size === 'small',
      'min-w-6 min-h-6': size === 'medium',
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
