<script setup lang="ts">
import type { ProjectEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: ProjectEventType
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item">
    <div class="text-xs">
      <strong>{{ item.data?.user?.name }}</strong> {{ item.data?.action }} <strong>{{ item.data?.table?.name }}</strong>
    </div>
  </NotificationItemWrapper>
</template>
