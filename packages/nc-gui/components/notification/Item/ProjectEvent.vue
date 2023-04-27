<script setup lang="ts">
import type { ProjectEventType } from 'nocodb-sdk'
import { AppEvents } from 'nocodb-sdk'
import { computed, toRef } from '#imports'

const props = defineProps<{
  item: ProjectEventType
}>()

const item = $(toRef(props, 'item'))

const action = computed(() => {
  switch (item.type) {
    case AppEvents.PROJECT_CREATE:
      return 'created'
    case AppEvents.PROJECT_UPDATE:
      return 'updated'
    case AppEvents.PROJECT_DELETE:
      return 'deleted'
  }
})

const onClick = () => {
  if(item.type === AppEvents.PROJECT_DELETE) return
  navigateTo(`/ws/${item.body.workspace_id}/nc/${item.body.id}`)
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="onClick">
    <div class="text-xs gap-2">
      Project
        <GeneralProjectIcon style="vertical-align:middle" :type="item.body.type" /> <strong>{{ item.body.title }}</strong>
      {{ action }} successfully
    </div>
  </NotificationItemWrapper>
</template>
