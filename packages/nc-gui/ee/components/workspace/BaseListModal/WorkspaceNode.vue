<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  workspace: NcWorkspace
  isSelected: boolean
  baseCount?: number
  planTitle?: string | null
}>()

const emit = defineEmits<{
  select: [workspaceId: string]
}>()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { appInfo } = useGlobal()

const { t } = useI18n()

const { switchWorkspace } = useWsBaseListActionsOrThrow()

const isActiveWorkspace = computed(() => {
  return activeWorkspaceId.value === props.workspace?.id
})

const isLocked = computed(() => workspaceStore.isWorkspaceCeLocked(props.workspace?.id))

const isCeMode = computed(() => appInfo.value?.isOnPrem && !appInfo.value?.ee)

const planLabel = computed(() => {
  if (isCeMode.value) return t('title.communityEdition')
  return `${props.workspace.payment?.plan?.title || props.planTitle || 'Free'} Plan`
})

const wsNodeRef = ref<HTMLDivElement>()

const onSelect = () => {
  if (isLocked.value) return
  emit('select', props.workspace.id!)
}

watch([wsNodeRef, isActiveWorkspace], () => {
  if (!wsNodeRef.value || !isActiveWorkspace.value) return

  wsNodeRef.value.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  })
})
</script>

<template>
  <div
    ref="wsNodeRef"
    :tabindex="isLocked ? -1 : 0"
    class="nc-workspace-node group flex items-center gap-2 px-2 py-1.5 rounded-lg my-0.5 border-1 border-transparent"
    :class="[
      isLocked
        ? 'nc-locked-workspace-node opacity-50 cursor-not-allowed'
        : isSelected
        ? 'nc-selected-workspace-node is-selected cursor-pointer'
        : 'hover:(bg-nc-bg-gray-light !border-nc-border-gray-medium) cursor-pointer',
    ]"
    @click="onSelect"
    @keydown.enter.stop="onSelect"
  >
    <GeneralWorkspaceIcon :workspace="workspace" size="medium" class="flex-none" />
    <div class="flex flex-col flex-1 min-w-0">
      <div class="flex items-center gap-1">
        <NcTooltip
          :show-on-truncate-only="!isLocked"
          class="nc-workspace-node-title min-w-0 text-sm font-medium truncate capitalize"
          :class="isLocked ? 'text-nc-content-gray-muted' : 'text-nc-content-gray-extreme'"
        >
          <template #title>
            {{ isLocked ? $t('title.activateLicenseToAccess') : workspace.title }}
          </template>
          {{ workspace.title }}
        </NcTooltip>
        <NcTooltip v-if="isLocked" :title="$t('title.activateLicenseToAccess')">
          <GeneralIcon icon="ncLock" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
        </NcTooltip>
      </div>
      <div class="flex items-center gap-1 text-xs text-nc-content-gray-muted mt-0.5">
        <span class="truncate">{{ isLocked ? $t('title.availableWithLicense') : planLabel }}</span>
        <template v-if="!isLocked">
          <span>·</span>
          <span class="truncate">{{ workspace.id }}</span>
          <NcTooltip :title="$t('labels.clickToCopyWorkspaceID')" hide-on-click class="flex" placement="right">
            <GeneralCopyButton
              :tabindex="-1"
              type="text"
              size="xxsmall"
              class="nc-workspace-id-copy-btn"
              icon-class="!w-3 !h-3"
              :content="workspace.id"
              :show-toast="false"
              @click.stop
            />
          </NcTooltip>
        </template>
      </div>
    </div>
    <NcTooltip v-if="!isLocked && workspace.roles === WorkspaceUserRoles.OWNER">
      <template #title>
        {{ $t('objects.roleType.owner') }}
      </template>
      <GeneralIcon icon="role_owner" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
    </NcTooltip>

    <GeneralIcon
      v-if="!isLocked"
      :icon="isActiveWorkspace ? 'ncCheck' : 'arrowRight'"
      class="text-nc-content-gray-muted flex-none h-4 w-4"
      :class="{
        'text-nc-content-brand': isActiveWorkspace,
        'nc-workspace-node-navigate-icon': !isActiveWorkspace,
      }"
      @click.stop="switchWorkspace(workspace.id)"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-node {
  @apply outline-none;

  &.is-selected {
    @apply bg-nc-bg-gray-light !border-nc-border-gray-medium;
  }

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
