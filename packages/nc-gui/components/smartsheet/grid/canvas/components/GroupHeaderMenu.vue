<script setup lang="ts">
import { generateGroupPath } from '../utils/groupby'
import type { CanvasGroup } from '#imports'

const props = defineProps<{
  group: CanvasGroup
}>()

const emit = defineEmits<{
  (e: 'toggleExpand', group: CanvasGroup): void
  (e: 'toggleExpandAll', path: Array<number>, expand: boolean): void
}>()

const { group } = toRefs(props)

const toggleExpand = (group: CanvasGroup) => {
  emit('toggleExpand', group)
}

const expandAllGroup = () => {
  const path = generateGroupPath(group.value)
  emit('toggleExpandAll', path, true)
}

const collapseAllGroup = () => {
  const path = generateGroupPath(group.value)
  emit('toggleExpandAll', path, false)
}
</script>

<template>
  <NcMenu variant="small">
    <NcMenuItem v-if="group?.isExpanded" @click="toggleExpand(group)">
      <GeneralIcon icon="minimize" />
      Collapse group
    </NcMenuItem>
    <NcMenuItem v-else @click="toggleExpand(group)">
      <GeneralIcon icon="maximize" />
      Expand group
    </NcMenuItem>
    <NcMenuItem @click="expandAllGroup">
      <GeneralIcon icon="maximizeAll" />
      Expand all
    </NcMenuItem>
    <NcMenuItem @click="collapseAllGroup">
      <GeneralIcon icon="minimizeAll" />
      Collapse all
    </NcMenuItem>
  </NcMenu>
</template>

<style scoped lang="scss"></style>
