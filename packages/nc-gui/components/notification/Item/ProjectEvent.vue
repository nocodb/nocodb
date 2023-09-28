<script setup lang="ts">
import type { ProjectEventType } from 'nocodb-sdk'
import { AppEvents } from 'nocodb-sdk'
import { computed, toRef, useGlobal } from '#imports'

const props = defineProps<{
  item: ProjectEventType
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

const action = computed(() => {
  switch (item.value.type) {
    case AppEvents.PROJECT_CREATE:
      return 'created'
    case AppEvents.PROJECT_UPDATE:
      return 'updated'
    case AppEvents.PROJECT_DELETE:
      return 'deleted'
  }
})

const onClick = () => {
  if (item.value.type === AppEvents.PROJECT_DELETE) return
  navigateToProject({ baseId: item.value.body.id })
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="onClick">
    <div class="text-xs gap-2">
      Base
      <GeneralProjectIcon style="vertical-align: middle" :type="item.body.type" /> <strong>{{ item.body.title }}</strong>
      {{ action }} successfully
    </div>
  </NotificationItemWrapper>
</template>
