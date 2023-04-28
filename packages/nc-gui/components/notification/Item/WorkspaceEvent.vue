<script setup lang="ts">
import type { TableEventType } from 'nocodb-sdk'
import { AppEvents } from 'nocodb-sdk'

const props = defineProps<{
  item: any
}>()

const item = $(toRef(props, 'item'))

const action = computed(() => {
  switch (item.type) {
    case AppEvents.WORKSPACE_CREATE:
      return 'created'
    case AppEvents.WORKSPACE_UPDATE:
      return 'updated'
    case AppEvents.WORKSPACE_DELETE:
      return 'deleted'
  }
})

const onClick = () => {
  if (item.type === AppEvents.WORKSPACE_DELETE) return
  navigateTo(`/ws/${item.body.id}`)
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="onClick">
    <div class="text-xs gap-2">
      Workspace
      <strong>{{ item.body.title }}</strong>
      {{ action }} successfully
    </div>
  </NotificationItemWrapper>
</template>
