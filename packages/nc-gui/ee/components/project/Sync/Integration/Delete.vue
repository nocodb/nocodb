<script setup lang="ts">
import type { SyncConfig } from 'nocodb-sdk'

interface Props {
  value: boolean
  baseId: string
  sync: SyncConfig
}

const props = defineProps<Props>()

const emits = defineEmits<{
  (e: 'update:value', value: boolean): void
  (e: 'deleted'): void
}>()

const { $e } = useNuxtApp()

const syncStore = useSyncStore()

const { deleteSync } = syncStore

const vOpen = useVModel(props, 'value', emits)

const dropTables = ref(false)

const isDeleting = ref(false)

watch(vOpen, (open) => {
  if (open) dropTables.value = false
})

const performDelete = async () => {
  isDeleting.value = true
  $e('c:integration-sync:delete:confirm', { dropTables: dropTables.value })
  try {
    // The sync store surfaces its own error toast and returns a falsy value on
    // failure — only treat the delete as done (and close) when it succeeds.
    const ok = await deleteSync(props.baseId, props.sync.id, { dropTables: dropTables.value })
    if (ok) {
      emits('deleted')
      vOpen.value = false
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isDeleting.value = false
  }
}

const handleCancel = () => {
  if (isDeleting.value) return
  vOpen.value = false
}
</script>

<template>
  <NcModal v-model:visible="vOpen" :show-separator="false" size="small" centered>
    <div class="flex gap-2 w-full text-base font-semibold mb-2 text-nc-content-gray-emphasis items-center">
      <GeneralIcon icon="alertTriangle" class="text-orange-500 !h-5 !w-5" />
      {{ $t('labels.deleteSync') }}
    </div>

    <div data-testid="nc-integration-sync-delete-modal" class="flex flex-col">
      <div class="mb-3 text-nc-content-gray">
        {{ $t('msg.deleteSyncIntro', { name: sync.title }) }}
      </div>

      <a-radio-group v-model:value="dropTables" class="nc-integration-sync-delete-options">
        <a-radio
          data-testid="nc-integration-sync-delete-keep"
          :style="{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }"
          :value="false"
        >
          <div class="flex flex-col gap-0.5 leading-5">
            <span class="font-semibold text-nc-content-gray">
              {{ $t('labels.convertToPlainTables') }}
            </span>
            <span class="text-bodySm text-nc-content-gray-muted">
              {{ $t('labels.convertToPlainTablesDesc') }}
            </span>
          </div>
        </a-radio>
        <a-radio
          data-testid="nc-integration-sync-delete-drop"
          :style="{ display: 'flex', alignItems: 'flex-start' }"
          :value="true"
        >
          <div class="flex flex-col gap-0.5 leading-5">
            <span class="font-semibold text-nc-content-gray">
              {{ $t('labels.deleteSyncedTables') }}
            </span>
            <span class="text-bodySm text-nc-content-gray-muted">
              {{ $t('labels.deleteSyncedTablesDesc') }}
            </span>
          </div>
        </a-radio>
      </a-radio-group>
    </div>

    <div class="flex flex-row mt-5 justify-end gap-x-2">
      <NcButton type="secondary" size="small" :disabled="isDeleting" @click="handleCancel">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton
        :type="dropTables ? 'danger' : 'primary'"
        size="small"
        :loading="isDeleting"
        data-testid="nc-integration-sync-delete-confirm"
        @click="performDelete"
      >
        {{ dropTables ? $t('general.delete') : $t('general.confirm') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-integration-sync-delete-options {
  :deep(.ant-radio-wrapper) {
    @apply items-start;
  }
}
</style>
