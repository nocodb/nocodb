<script setup lang="ts">
import type { UserType } from 'nocodb-sdk'

const { user } = defineProps<{
  user: UserType
}>()

const displayName = computed(() => {
  return user?.display_name?.trim() ? user?.display_name?.trim() : user?.email?.split('@')[0]
})
</script>

<template>
  <div class="flex flex-row items-center gap-x-2 h-12.5 p-2">
    <GeneralUserIcon size="base" :user="user" class="!text-[0.65rem]" />
    <div class="flex flex-col justify-center flex-grow">
      <div class="flex flex-col">
        <span class="capitalize font-weight-medium">{{ displayName }}</span>
        <span class="text-xs">{{ user.email }}</span>
      </div>
    </div>
    <slot name="append"></slot>
  </div>
</template>
