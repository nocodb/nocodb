<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

const props = defineProps<{
  workspace: WorkspaceType
  isSelected: boolean
  baseCount?: number
}>()

const emit = defineEmits<{
  select: [workspaceId: string]
}>()

const onSelect = () => {
  emit('select', props.workspace.id!)
}
</script>

<template>
  <div
    :tabindex="0"
    :class="[
      'nc-workspace-node group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer my-1 border-1 border-transparent',
      isSelected
        ? 'bg-nc-bg-gray-medium !border-nc-border-gray-dark'
        : 'hover:(bg-nc-bg-gray-light !border-nc-border-gray-medium)',
    ]"
    @click="onSelect"
    @keydown.enter.stop="onSelect"
  >
    <GeneralWorkspaceIcon :workspace="workspace" size="large" class="flex-none" />
    <div class="flex flex-col flex-1 min-w-0">
      <span class="text-sm font-medium text-nc-content-gray-extreme truncate capitalize">
        {{ workspace.title }}
      </span>
      <div class="flex items-center gap-2">
        <span class="text-xs text-nc-content-gray-muted truncate">
          {{ workspace.payment?.plan?.title || 'Free' }}
        </span>
        <span v-if="selected && baseCount !== undefined" class="text-xs text-nc-content-gray-muted">
          {{ baseCount }} {{ baseCount !== 1 ? $t('objects.projects') : $t('objects.project') }}
        </span>
      </div>
    </div>
    <GeneralIcon v-if="isSelected" icon="check" class="text-nc-content-brand flex-none" />
    <GeneralIcon
      v-else
      icon="arrowRight"
      class="text-nc-content-gray-muted flex-none opacity-0 group-hover:opacity-100 transition-opacity"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-node {
  @apply outline-none;

  &:focus-visible {
    @apply outline-none shadow-focus;
  }
}
</style>
