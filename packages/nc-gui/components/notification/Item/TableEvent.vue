<script setup lang="ts">
import type { TableEventType} from 'nocodb-sdk'
import {AppEvents} from "nocodb-sdk";

const props = defineProps<{
  item: TableEventType
}>()

const item = $(toRef(props, 'item'))

const action = computed(() => {
  switch (item.type) {
    case AppEvents.TABLE_CREATE:
      return 'created'
    case AppEvents.TABLE_UPDATE:
      return 'updated'
    case AppEvents.TABLE_DELETE:
      return 'deleted'
  }
})

const onClick = () => {
  if(item.type === AppEvents.TABLE_DELETE) return
  navigateTo(`/ws/${item.body.workspace_id}/nc/${item.body.id}`)
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="onClick">
    <div class="text-xs gap-2">
      Table
      <strong>{{ item.body.title }}</strong>
      {{ action }} successfully
    </div>
  </NotificationItemWrapper>
</template>
