<script setup lang="ts">
import type { WelcomeEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: WelcomeEventType
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item">
    <div class="text-sm min-h-12">Welcome to <strong>NocoDB!</strong> We’re excited to have you onboard.</div>
  </NotificationItemWrapper>
</template>
