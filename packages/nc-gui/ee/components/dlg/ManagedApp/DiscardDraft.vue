<script lang="ts" setup>
interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { $api } = useNuxtApp()

const { t } = useI18n()

const baseStore = useBase()

const { loadManagedApp, loadCurrentVersion } = baseStore

const { base, managedApp, managedAppVersionsInfo } = storeToRefs(baseStore)

const isLoading = ref(false)

const loadManagedAppAndCurrentVersion = async () => {
  await loadManagedApp()
  await loadCurrentVersion()
}

const discardDraft = async () => {
  if (!base.value?.fk_workspace_id || !base.value?.id || !managedApp.value?.id) return

  isLoading.value = true

  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      base.value.id,
      {
        operation: 'managedAppDiscardDraft',
      },
      {
        managedAppId: managedApp.value.id,
      },
    )

    // Reload base to get updated managed app version info
    if (base.value?.id) {
      await baseStore.loadProject()
    }

    await loadManagedAppAndCurrentVersion()

    message.success(t('msg.draftDiscardedSuccessfully'))

    vVisible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <DlgManagedAppHeader v-model:visible="vVisible" :title="$t('title.discardDraft')">
      <template #icon>
        <GeneralIcon icon="delete" class="w-5 h-5 text-white" />
      </template>
    </DlgManagedAppHeader>

    <div class="flex-1 nc-scrollbar-thin p-4">
      <div class="mb-3 text-nc-content-gray">
        {{ $t('msg.discardDraftConfirmation') }}
      </div>

      <!-- Version info preview -->
      <div class="flex flex-col gap-2">
        <div class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle">
          <GeneralIcon icon="edit" class="text-orange-600 w-4 h-4" />
          <div class="pl-3 flex-1">
            <span class="text-nc-content-gray-subtle2 text-sm">{{ $t('labels.currentDraft') }}:</span>
            <span class="ml-1 font-medium">v{{ managedAppVersionsInfo.current?.version || '1.0.0' }}</span>
          </div>
        </div>
        <div class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle">
          <GeneralIcon icon="circleCheck3" class="text-green-600 w-4 h-4" />
          <div class="pl-3 flex-1">
            <span class="text-nc-content-gray-subtle2 text-sm">{{ $t('labels.rollbackTo') }}:</span>
            <span class="ml-1 font-medium">v{{ managedAppVersionsInfo.published?.version || '1.0.0' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="nc-discard-footer">
      <NcButton type="secondary" size="small" :disabled="isLoading" @click="vVisible = false">
        {{ $t('general.cancel') }}
      </NcButton>

      <NcButton
        key="submit"
        type="danger"
        size="small"
        :loading="isLoading"
        data-testid="nc-discard-draft-btn"
        @click="discardDraft"
      >
        {{ $t('labels.discardDraft') }}
        <template #loading>
          {{ $t('labels.discarding') }}
        </template>
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-discard-footer {
  @apply px-4 py-3 flex items-center justify-end gap-2;
}
</style>
