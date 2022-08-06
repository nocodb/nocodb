<script lang="ts" setup>
import { computed } from '#imports'
import { useExpandedFormStoreOrThrow } from '~/composables'
import MdiDoorOpen from '~icons/mdi/door-open'
import MdiDoorClosed from '~icons/mdi/door-closed'

const { commentsDrawer } = useExpandedFormStoreOrThrow()

const drawerToggleIcon = computed(() => (commentsDrawer.value ? MdiDoorOpen : MdiDoorClosed))
</script>

<template>
  <div class="flex p-2">
    <div class="flex-grow" />
    <component :is="drawerToggleIcon" class="" @click="commentsDrawer = !commentsDrawer" />
  </div>
</template>

<style scoped></style>
