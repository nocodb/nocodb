<script setup lang="ts">
import type { ProjectEventType } from 'nocodb-sdk'
import {AppEvents} from "nocodb-sdk";

const props = defineProps<{
  item: ProjectEventType
}>()

const item = $(toRef(props, 'item'))

const action = computed(() => {
  switch (item.type) {
    case AppEvents.VIEW_CREATE:
      return 'created'
    case AppEvents.VIEW_UPDATE:
      return 'updated'
    case AppEvents.VIEW_DELETE:
      return 'deleted'
  }
})

const onClick = () => {
  if(item.type === AppEvents.VIEW_DELETE) return
  navigateTo(`/ws/${item.body.workspace_id}/nc/${item.body.id}`)
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="onClick">
    <div class="text-xs gap-2">
      Shared view
      <strong>{{ item.body.title }}</strong>
      {{ action }} successfully
    </div>
  </NotificationItemWrapper>
</template>
