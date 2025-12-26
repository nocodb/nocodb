<script setup lang="ts">
import { BaseVersion } from 'nocodb-sdk'

const { t } = useI18n()
const { $api } = useNuxtApp()

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const { navigateToProject } = useGlobal()

const _projectId = inject(ProjectIdInj, undefined)

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const isLoading = ref(false)
const isModalVisible = ref(false)

const migrateToV3 = async () => {
  if (!baseId.value) return

  isLoading.value = true
  try {
    // Note: This endpoint needs to be implemented on the backend
    // to properly migrate a base from V2 to V3
    await $api.base.update(baseId.value, {
      version: BaseVersion.V3,
    })

    message.success(t('msg.success.baseUpgradedToV3'))

    // Reload the base after migration
    await basesStore.loadProject(baseId.value, true)

    isModalVisible.value = false

    navigateToProject({
      workspaceId: base.value?.fk_workspace_id,
      baseId: baseId.value,
      query: {
        page: 'overview',
      },
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div data-testid="nc-settings-subtab-migrate-to-v3" class="item-card flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">
      {{ $t('labels.migrateToV3') }}
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      Upgrade your base to V3 for enhanced capabilities and new features.
    </div>

    <div class="flex flex-col border-1 rounded-lg mt-6 border-nc-border-gray-medium p-4 gap-4">
      <div class="flex flex-col gap-3">
        <div class="flex items-start gap-2">
          <GeneralIcon icon="check" class="flex-none text-nc-content-brand mt-0.5" />
          <span class="text-nc-content-gray"> V3 bases allow bases to be duplicated with same ids for entities under base </span>
        </div>

        <div class="flex items-start gap-2">
          <GeneralIcon icon="check" class="flex-none text-nc-content-brand mt-0.5" />
          <span class="text-nc-content-gray"> It will be only possible to use via v3 API </span>
        </div>

        <div class="flex items-start gap-2">
          <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5" />
          <span class="text-nc-content-gray font-semibold"> V1 and V2 API access will not be allowed </span>
        </div>

        <div class="flex items-start gap-2">
          <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5" />
          <span class="text-nc-content-gray font-semibold">
            This operation is irreversible and there is no going back after migrate
          </span>
        </div>
      </div>

      <div class="flex gap-2">
        <NcButton size="medium" type="primary" data-testid="nc-migrate-to-v3-button" @click="isModalVisible = true">
          {{ $t('labels.migrateToV3') }}
        </NcButton>
      </div>
    </div>

    <GeneralModal v-model:visible="isModalVisible" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-3 font-medium text-lg text-nc-content-gray">
          {{ $t('labels.migrateToV3') }}
        </div>

        <div class="mb-3 text-nc-content-gray">Do you want to migrate this base to V3?</div>

        <div v-if="base" class="flex flex-col gap-3 p-4 bg-nc-bg-gray-extralight rounded-lg mb-3">
          <div class="flex items-start gap-2">
            <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5" />
            <span class="text-nc-content-gray font-semibold text-sm"> V1 and V2 API access will not be allowed </span>
          </div>
          <div class="flex items-start gap-2">
            <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5" />
            <span class="text-nc-content-gray font-semibold text-sm">
              This operation is irreversible and there is no going back after migrate
            </span>
          </div>
        </div>

        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton type="secondary" size="small" @click="isModalVisible = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <NcButton
            key="submit"
            type="danger"
            size="small"
            html-type="submit"
            :loading="isLoading"
            data-testid="nc-migrate-to-v3-confirm-btn"
            @click="migrateToV3"
          >
            {{ $t('labels.migrateToV3') }}
            <template #loading>
              {{ $t('general.migrating') }}
            </template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>
