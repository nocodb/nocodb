<script lang="ts" setup>
const props = defineProps<{
  hideLabel?: boolean
  size?: 'small' | 'medium'
}>()

const { user } = useGlobal()

const backgroundColor = computed(() => (user.value?.id ? stringToColour(user.value?.id) : '#FFFFFF'))

const size = computed(() => props.size || 'medium')

const firstName = computed(() => user.value?.firstname ?? '')
const lastName = computed(() => user.value?.lastname ?? '')
const email = computed(() => user.value?.email ?? '')

const usernameInitials = computed(() => {
  if (firstName.value && lastName.value) {
    return firstName.value[0] + lastName.value[0]
  } else if (firstName.value) {
    return firstName.value[0] + (firstName.value.length > 1 ? firstName.value[1] : '')
  } else if (lastName.value) {
    return lastName.value[0] + (lastName.value.length > 1 ? lastName.value[1] : '')
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
    }"
    :style="{ backgroundColor }"
  >
    <template v-if="!props.hideLabel">
      {{ usernameInitials }}
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-user-avatar {
  @apply rounded-full text-xs flex items-center justify-center text-white uppercase;
}
</style>
