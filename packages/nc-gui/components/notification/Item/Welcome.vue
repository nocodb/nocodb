<script setup lang="ts">
import type { WelcomeEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: WelcomeEventType
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item">
    <div>Welcome to <span class="font-semibold">NocoDB!</span> We’re excited to have you onboard.</div>
  </NotificationItemWrapper>
</template>
