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

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { switchWorkspace } = useWsBaseListActionsOrThrow()

const isActiveWorkspace = computed(() => {
  return activeWorkspaceId.value === props.workspace?.id
})

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
        ? 'nc-selected-workspace-node bg-nc-bg-gray-light !border-nc-border-gray-medium'
        : 'hover:(bg-nc-bg-gray-light !border-nc-border-gray-medium)',
    ]"
    @click="onSelect"
    @keydown.enter.stop="onSelect"
  >
    <GeneralWorkspaceIcon :workspace="workspace" size="large" class="flex-none" />
    <div class="flex flex-col flex-1 min-w-0">
      <div class="flex items-center gap-1">
        <NcTooltip show-on-truncate-only class="nc-workspace-node-title min-w-0 text-sm font-medium text-nc-content-gray-extreme truncate capitalize">
          <template #title>
            {{ workspace.title }}
          </template>
          {{ workspace.title }}
        </NcTooltip>
      </div>
      <div class="flex items-center gap-1 text-xs text-nc-content-gray-muted mt-1">
        <span class="truncate">
          {{ workspace.payment?.plan?.title || 'Free' }}
        </span>
        <span> - </span>
        <div class="flex items-center gap-1.5 cursor-pointer">
          {{ $t('datatype.ID') }}: {{ workspace.id }}

          <NcTooltip :title="$t('labels.clickToCopyWorkspaceID')" hide-on-click class="flex" placement="right">
            <GeneralCopyButton
              :tabindex="-1"
              type="text"
              size="xxsmall"
              class="nc-workspace-id-copy-btn"
              icon-class="!w-3.5 !h-3.5"
              :content="workspace.id"
              :show-toast="false"
              @click.stop
            />
          </NcTooltip>
        </div>
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
    <NcTooltip hide-on-click class="flex">
      <template #title>
        {{ isActiveWorkspace ? 'Active Workspace' : 'Click to navigate to this workspace' }}
      </template>
      <GeneralIcon
        :icon="isActiveWorkspace ? 'ncCheck' : 'arrowRight'"
        class="text-nc-content-gray-muted flex-none h-4 w-4"
        :class="{
          'text-nc-content-brand': isActiveWorkspace,
          'nc-workspace-node-navigate-icon': !isActiveWorkspace,
        }"
        @click.stop="switchWorkspace(workspace.id)"
      />
    </NcTooltip>
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-node {
  @apply outline-none;

  &:focus-visible {
    @apply outline-none shadow-focus;
  }

  .nc-copy-id-btn {
    @apply transition-opacity duration-200;
  }

  .nc-workspace-id-copy-btn {
    @apply opacity-0 transition-opacity duration-200 !p-0 min-w-4;
    width: 16px !important;
    height: 16px !important;
  }

  &:hover {
    .nc-workspace-id-copy-btn {
      @apply opacity-100;
    }
  }

  &:hover .nc-copy-id-btn {
    @apply opacity-100;
  }
}
</style>
