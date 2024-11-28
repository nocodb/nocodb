<script lang="ts" setup>
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

const restoreSnapshot = async (snapshot: SnapshotExtendedType) => {
  try {
    await _restoreSnapshot(snapshot, () => {
      vModel.value = false
      emits('update:modelValue', false)
    })
  } catch (error) {
    console.error(error)
  }
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

    <div class="text-nc-content-gray-subtle2 my-2 leading-5">Are you sure you want to restore this base snapshot.</div>

    <div class="leading-5 text-nc-content-gray-subtle">Note:</div>

    <ul class="list-disc leading-5 text-nc-content-gray-subtle pl-4 !mb-0">
      <li>Restoring this snapshot will not affect the existing base.</li>
      <li>
        On restore, a new base

        <span class="font-semibold">
          {{ snapshot.title }}
        </span>
        will be created in the same workspace.
      </li>
    </ul>

    <div class="my-5 px-4 py-2 bg-nc-bg-gray-light rounded-lg">
      {{ snapshot.title }}
    </div>

    <div class="flex items-center gap-2 justify-end">
      <NcButton :disabled="isRestoringSnapshot" type="secondary" size="small" @click="vModel = false">
        {{ $t('general.cancel') }}
      </NcButton>

      <NcButton
        :disabled="isRestoringSnapshot"
        type="primary"
        size="small"
        :loading="isRestoringSnapshot"
        @click="restoreSnapshot(snapshot)"
      >
        {{ isRestoringSnapshot ? 'Restoring Snapshot' : $t('labels.confirmRestore') }}
      </NcButton>
    </div>
  </NcModal>
</template>
