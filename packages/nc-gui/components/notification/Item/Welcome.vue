<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateTo(`/`)">
    <div class="text-xs">Welcome to <strong>NocoHUB!</strong> We’re excited to have you onboard.</div>
  </NotificationItemWrapper>
</template>
