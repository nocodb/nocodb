<script setup lang="ts">
import { AppEvents } from 'nocodb-sdk'
import { useGlobal } from '#imports'

const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')

const globalStore = useGlobal()
const navigateToProject = toRef(globalStore, 'navigateToProject')

const action = computed(() => {
  switch (item.value.type) {
    case AppEvents.WORKSPACE_CREATE:
      return 'created'
    case AppEvents.WORKSPACE_UPDATE:
      return 'updated'
    case AppEvents.WORKSPACE_DELETE:
      return 'deleted'
  }
})

const onClick = () => {
  if (item.value.type === AppEvents.WORKSPACE_DELETE) return
  navigateToProject.value({ workspaceId: item.value.body.id })
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
