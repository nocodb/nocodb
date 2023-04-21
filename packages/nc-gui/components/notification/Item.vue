<script setup lang="ts">
import { toRef } from '#imports'

const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')
</script>

<template>
  <div class="select-none">
  <NotificationItemWelcome v-if="item.type === 'WELCOME'" :item="item"/>
  <NotificationItemProjectInvite v-else-if="item.type === 'PROJECT_INVITE'"  :item="item"/>
  <NotificationItemWorkspaceInvite v-else-if="item.type === 'WORKSPACE_INVITE'"  :item="item"/>
  <span v-else />
  </div>
</template>

<style scoped></style>
