<script lang="ts" setup>
import { type WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk'

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
}
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
      <li>On restore, a new base will be created in the selected workspace.</li>
    </ul>

    <div class="flex flex-col mb-5 gap-1">
      <NcDropdown v-model:visible="isDropdownActive" class="mt-2">
        <div
          class="rounded-lg border-1 transition-all cursor-pointer flex items-center border-nc-border-grey-medium h-8 py-1 gap-2 px-3"
          style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
          :class="{
            '!border-brand-500 !shadow-selected': isDropdownActive,
          }"
        >
          <GeneralWorkspaceIcon size="small" :workspace="selectedWorkspace" />

          <div class="flex-1 capitalize truncate">
            {{ selectedWorkspace?.title }}
          </div>

          <div class="flex gap-2 items-center">
            <div v-if="activeWorkspace?.id === selectedWorkspace?.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
              {{ $t('labels.currentWorkspace') }}
            </div>
            <GeneralIcon
              :class="{
                'transform rotate-180': isDropdownActive,
              }"
              class="text-nc-content-gray transition-all w-4 h-4"
              icon="ncChevronDown"
            />
          </div>
        </div>

        <template #overlay>
          <NcList
            :value="selectedWorkspace"
            :item-height="28"
            close-on-select
            :min-items-for-search="6"
            container-class-name="w-full"
            :list="filteredWorkspaces"
            option-label-key="title"
          >
            <template #listHeader>
              <div class="text-nc-content-gray-muted text-[13px] px-3 py-2.5 font-medium leading-5">
                You can only restore into workspaces where you have creator access or above.
              </div>

              <NcDivider />
            </template>

            <template #listItem="{ option }">
              <div class="flex gap-2 w-full items-center" @click="selectWorkspace(option)">
                <GeneralWorkspaceIcon :workspace="option" size="small" />

                <div class="flex-1 text-[13px] truncate font-semibold leading-5 capitalize w-full">
                  {{ option.title }}
                </div>

                <div class="flex items-center gap-2">
                  <div v-if="activeWorkspace?.id === option.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                    {{ $t('labels.currentWorkspace') }}
                  </div>
                  <GeneralIcon v-if="option.id === selectedWorkspace?.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                </div>
              </div>
            </template>
          </NcList>
        </template>
      </NcDropdown>
    </div>

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
        @click="restoreSnapshot(snapshot, selectedWorkspace)"
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

.nc-list {
  .nc-list-item {
    @apply !py-1;
  }
}

.nc-list-root {
  @apply !w-[400px] !pt-0;
}
</style>
