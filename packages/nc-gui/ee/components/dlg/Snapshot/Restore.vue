<script lang="ts" setup>
import { type WorkspaceType } from 'nocodb-sdk'

interface Props {
  modelValue: boolean
  snapshot: SnapshotExtendedType
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'restored'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { snapshot } = props

const vModel = useVModel(props, 'modelValue', emits)

const { restoreSnapshot: _restoreSnapshot, isRestoringSnapshot } = useBaseSettings()

const restoreSnapshot = async (snapshot: SnapshotExtendedType, _workspace?: WorkspaceType) => {
  try {
    await _restoreSnapshot(snapshot, _workspace, () => {
      vModel.value = false
      emits('update:modelValue', false)
    })
  } catch (error) {
    console.error(error)
  }
}

/*
const selectedWorkspace = ref<WorkspaceType>()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace } = storeToRefs(workspaceStore)

const isDropdownActive = ref(false)

const filteredWorkspaces = computed(() => {
  return workspacesList.value?.filter((ws) => ws.roles === WorkspaceUserRoles.OWNER || ws.roles === WorkspaceUserRoles.CREATOR)
})

onMounted(() => {
  if (activeWorkspace.value) {
    selectedWorkspace.value = activeWorkspace.value
  }
})

const selectWorkspace = (workspace: WorkspaceType) => {
  selectedWorkspace.value = workspace
  isDropdownActive.value = false
} */
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :mask-closable="!isRestoringSnapshot"
    size="xs"
    height="auto"
    :show-separator="false"
    nc-modal-class-name="!p-6"
  >
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">Confirm Snapshot Restore</div>

    <div class="text-nc-content-gray-subtle my-2 leading-5">Are you sure you want to restore this base snapshot.</div>

    <div class="my-5 px-4 py-2 bg-nc-bg-gray-light rounded-lg">
      <NcTooltip show-on-truncate-only class="truncate">
        {{ snapshot.title }}
        <template #title>
          {{ snapshot.title }}
        </template>
      </NcTooltip>
    </div>

    <div class="leading-5 text-nc-content-gray-subtle2">Note:</div>

    <ul class="list-disc leading-5 text-nc-content-gray-subtle2 pl-4 !mb-5">
      <li>Restoring this snapshot will not affect the existing base.</li>
      <li>On restore, a new base will be created in the same workspace.</li>
    </ul>

    <!--    <div class="flex flex-col mb-5 gap-1">
      <NcDropdown v-model:visible="isDropdownActive">
        <div
          style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
          :class="{
            '!border-brand-500 !shadow-selected': isDropdownActive,
          }"
          class="border-1 border-nc-content-gray-medium transition-all cursor-pointer items-center py-2 flex gap-4 px-3 rounded-lg"
        >
          <GeneralWorkspaceIcon :workspace="selectedWorkspace" size="middle" />

          <NcTooltip
            show-on-truncate-only
            class="text-nc-content-gray truncate text-nc-content-gray flex-1 font-semibold leading-5"
          >
            <template #title>
              {{ selectedWorkspace?.title }}
            </template>
            {{ selectedWorkspace?.title }}
          </NcTooltip>

          <RolesBadge :border="false" :role="selectedWorkspace?.roles" size="small" />

          <GeneralIcon icon="chevronDown" />
        </div>

        <template #overlay>
          <div class="max-h-300px nc-scrollbar-md !overflow-y-auto py-1">
            <div
              v-for="workspace of filteredWorkspaces"
              :key="workspace.id!"
              class="group py-2 flex gap-4 cursor-pointer px-3 w-full rounded-lg capitalize flex items-center hover:bg-nc-bg-gray-light"
              @click="selectWorkspace(workspace)"
            >
              <div class="flex flex-row w-full truncate items-center gap-2">
                <GeneralWorkspaceIcon class="restore-snapshot" :workspace="workspace" size="middle" />

                <NcTooltip show-on-truncate-only class="text-nc-content-gray flex-1 truncate font-semibold leading-5">
                  {{ workspace?.title }}
                  <template #title>
                    {{ workspace?.title }}
                  </template>
                </NcTooltip>
                <RolesBadge :border="false" :role="workspace?.roles" size="small" />

                <GeneralIcon
                  :class="{
                    'opacity-100': selectedWorkspace === workspace,
                  }"
                  class="opacity-0 text-nc-content-brand"
                  icon="ncCheck"
                />
              </div>
            </div>
          </div>
        </template>
      </NcDropdown>
    </div> -->

    <div class="flex items-center gap-2 justify-end">
      <NcButton :disabled="isRestoringSnapshot" type="secondary" size="small" @click="vModel = false">
        {{ $t('general.cancel') }}
      </NcButton>

      <NcButton
        :disabled="isRestoringSnapshot"
        type="primary"
        data-testid="confirm-restore-snapshot-btn"
        size="small"
        :loading="isRestoringSnapshot"
        @click="restoreSnapshot(snapshot)"
      >
        {{ isRestoringSnapshot ? 'Restoring Snapshot' : $t('labels.confirmRestore') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss">
.restore-snapshot {
  .nc-workspace-avatar {
    @apply min-w-8 w-6 h-8 rounded-md;
  }
}
</style>
