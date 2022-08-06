<script lang="ts" setup>
import { computed } from '#imports'
import { useExpandedFormStoreOrThrow, useSmartsheetStoreOrThrow } from '~/composables'
import MdiDoorOpen from '~icons/mdi/door-open'
import MdiDoorClosed from '~icons/mdi/door-closed'
import MdiTableArrowRightIcon from '~icons/mdi/table-arrow-right'
import MdiTableArrowRightIcon from '~icons/mdi/table-arrow-right'

const {meta} = useSmartsheetStoreOrThrow()
const { commentsDrawer, row, primaryValue } = useExpandedFormStoreOrThrow()

const drawerToggleIcon = computed(() => (commentsDrawer.value ? MdiDoorOpen : MdiDoorClosed))

// todo: accept as a prop / inject
const iconColor =  '#1890ff'

</script>

<template>
  <div class="flex p-2 align-center">
    <h5 class="text-md font-weight-bold flex align-center gap-1 mb-0">
      <MdiTableArrowRightIcon :style="{color:iconColor}"/>

      <template v-if="meta">
        {{ meta.title }}
      </template>
      <template v-else>
        {{ table }}
      </template>
      <template v-if="primaryValue">: {{ primaryValue }}</template>
    </h5>
    <div class="flex-grow" />
    <component :is="drawerToggleIcon" class="" @click="commentsDrawer = !commentsDrawer" />
  </div>
</template>

<style scoped></style>
