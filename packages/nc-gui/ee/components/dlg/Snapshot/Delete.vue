<script lang="ts" setup>
interface Props {
  modelValue: boolean
  snapshot: SnapshotExtendedType
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'deleted'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { snapshot } = props

const vModel = useVModel(props, 'modelValue', emits)

const { deleteSnapshot } = useBaseSettings()

async function onDelete() {
  if (!snapshot.id) return

  try {
    await deleteSnapshot(snapshot)

    vModel.value = false
    emits('deleted')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="vModel" :entity-name="$t('general.snapshot')" :on-delete="onDelete">
    <template #entity-preview>
      <div class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700">
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          <span>
            {{ snapshot.title }}
          </span>
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
