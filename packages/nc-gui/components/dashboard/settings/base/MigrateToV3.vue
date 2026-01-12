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

    await navigateToProject({
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
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">Migrate to v3</div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      Upgrade this base to v3 to unlock the latest platform capabilities and future-ready APIs.
      <a href="https://docs.nocodb.com/" target="_blank" rel="noopener noreferrer" class="text-nc-content-brand"> Learn more </a>
    </div>

    <div class="mt-6">
      <div class="text-nc-content-gray-emphasis font-semibold mb-3">What changes after migration</div>
      <div class="flex flex-col gap-2 mb-6">
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            Bases can be duplicated while <span class="font-semibold">preserving entity IDs</span>
          </span>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            Access is available <span class="font-semibold">only via the V3 API</span>
          </span>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">Designed for improved scalability and long-term compatibility</span>
        </div>
      </div>

      <div class="text-nc-content-gray-emphasis font-semibold mb-3">Important considerations</div>
      <div class="flex flex-col gap-2 mb-4">
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            <span class="font-semibold">V1 and V2 APIs will no longer work</span> for this base after migration to v3
          </span>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            <span class="font-semibold">Migration is permanent</span> — reverting back to earlier versions is not supported
          </span>
        </div>
      </div>

      <div class="bg-nc-bg-gray-light border-l-4 border-nc-content-brand p-3 mb-6">
        <span class="text-nc-content-gray text-sm">
          We recommend migrating only after confirming all integrations are compatible with the v3 API.
        </span>
      </div>

      <div class="flex gap-2">
        <NcButton size="medium" type="primary" data-testid="nc-migrate-to-v3-button" @click="isModalVisible = true">
          Migrate to v3
        </NcButton>
      </div>
    </div>

    <GeneralModal v-model:visible="isModalVisible" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-4 font-semibold text-lg text-nc-content-gray-emphasis">Migrate to V3</div>

        <div class="mb-2 text-nc-content-gray-emphasis font-medium">Are you sure you want to migrate this base to v3?</div>

        <div class="mb-4 text-nc-content-gray text-sm">
          This change upgrades the base to the latest architecture and API version.
        </div>

        <div v-if="base" class="mb-4">
          <div class="text-nc-content-gray-emphasis font-medium mb-2 text-sm">Before you continue</div>
          <div class="flex flex-col gap-2">
            <div class="flex items-start gap-2">
              <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5 w-4 h-4" />
              <span class="text-nc-content-gray text-sm">
                <span class="font-semibold">V1 and V2 APIs will no longer work</span> for this base
              </span>
            </div>
            <div class="flex items-start gap-2">
              <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5 w-4 h-4" />
              <span class="text-nc-content-gray text-sm">
                <span class="font-semibold">Migration is permanent</span> — this action cannot be undone
              </span>
            </div>
          </div>
        </div>

        <div class="flex flex-row gap-x-2 mt-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="small" @click="isModalVisible = false"> Cancel </NcButton>

          <NcButton
            key="submit"
            type="primary"
            size="small"
            html-type="submit"
            :loading="isLoading"
            data-testid="nc-migrate-to-v3-confirm-btn"
            @click="migrateToV3"
          >
            Confirm migration to v3
            <template #loading> Migrating... </template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>
