<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  workspace: NcWorkspace
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
        ? 'bg-nc-bg-gray-light !border-nc-border-gray-medium'
        : 'hover:(bg-nc-bg-gray-light !border-nc-border-gray-medium)',
    ]"
    @click="onSelect"
    @keydown.enter.stop="onSelect"
  >
    <GeneralWorkspaceIcon :workspace="workspace" size="large" class="flex-none" />
    <div class="flex flex-col flex-1 min-w-0">
      <NcTooltip show-on-truncate-only class="min-w-0 text-sm font-medium text-nc-content-gray-extreme truncate capitalize">
        <template #title>
          {{ workspace.title }}
        </template>

        {{ workspace.title }}
      </NcTooltip>
      <div class="flex items-center gap-2">
        <span class="text-xs text-nc-content-gray-muted truncate">
          {{ workspace.payment?.plan?.title || 'Free' }}
        </span>
        <span v-if="selected && baseCount !== undefined" class="text-xs text-nc-content-gray-muted">
          {{ baseCount }} {{ baseCount !== 1 ? $t('objects.projects') : $t('objects.project') }}
        </span>
      </div>
    </div>
    <NcTooltip v-if="workspace.roles === WorkspaceUserRoles.OWNER">
      <template #title>
        {{ $t('objects.roleType.owner') }}
      </template>
      <div class="h-6.5 px-1 py-0.25 rounded-lg bg-nc-purple-50">
        <GeneralIcon
          icon="role_owner"
          class="min-w-4.5 min-h-4.5 text-xl !text-nc-content-purple-dark !hover:text-nc-content-purple-dark"
        />
      </div>
    </NcTooltip>
    <GeneralIcon icon="arrowRight" class="text-nc-content-gray-muted flex-none" />
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
