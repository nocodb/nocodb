<script setup lang="ts">
import type { CanvasGroup } from '#imports'

const props = defineProps<{
  group: CanvasGroup
  hasSubgroups?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleExpand', group: CanvasGroup): void
  (e: 'toggleExpandSubgroups', group: CanvasGroup, expand: boolean): void
  (e: 'toggleExpandAll', expand: boolean): void
}>()

const { group } = toRefs(props)
</script>

<template>
  <NcMenu variant="small">
    <NcMenuItem v-if="group?.isExpanded" @click="emit('toggleExpand', group)">
      <GeneralIcon icon="minimize" />
      {{ $t('labels.collapseGroup') }}
    </NcMenuItem>
    <NcMenuItem v-else @click="emit('toggleExpand', group)">
      <GeneralIcon icon="maximize" />
      {{ $t('labels.expandGroup') }}
    </NcMenuItem>
    <template v-if="hasSubgroups">
      <NcMenuItem @click="emit('toggleExpandSubgroups', group, true)">
        <GeneralIcon icon="maximizeAll" />
        {{ $t('labels.expandSubgroups') }}
      </NcMenuItem>
      <NcMenuItem @click="emit('toggleExpandSubgroups', group, false)">
        <GeneralIcon icon="minimizeAll" />
        {{ $t('labels.collapseSubgroups') }}
      </NcMenuItem>
    </template>
    <NcMenuItem @click="emit('toggleExpandAll', true)">
      <GeneralIcon icon="maximizeAll" />
      {{ $t('labels.expandAll') }}
    </NcMenuItem>
    <NcMenuItem @click="emit('toggleExpandAll', false)">
      <GeneralIcon icon="minimizeAll" />
      {{ $t('labels.collapseAll') }}
    </NcMenuItem>
  </NcMenu>
</template>
