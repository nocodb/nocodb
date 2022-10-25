<script setup lang="ts">
import { defineProps } from '#imports'

const props = defineProps<{
  tabKey: string
}>()
</script>

<template>
  <template v-if="props.tabKey === 'list'">
    <LazyAccountUserList />
  </template>
  <template v-else-if="props.tabKey === 'settings'">
    <LazyAccountSignupSettings />
  </template>
  <template v-else-if="props.tabKey === 'password-reset'">
    <LazyAccountResetPassword />
  </template>
</template>
