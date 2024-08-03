<script lang="ts" setup>
import { type IntegrationType, type SourceType } from 'nocodb-sdk'

const { integrations, loadIntegrations, integrationType, addIntegration, deleteIntegration, editIntegration } =
  useIntegrationStore()

const { $e } = useNuxtApp()

onMounted(async () => {
  await loadIntegrations()
})

const isDeleteIntegrationModalOpen = ref(false)
const toBeDeletedIntegration = ref<SourceType | null>(null)

const openDeleteIntegration = (source: IntegrationType) => {
  $e('c:integration:delete')
  isDeleteIntegrationModalOpen.value = true
  toBeDeletedIntegration.value = source
}

const onDeleteConfirm = async () => {
  if (toBeDeletedIntegration.value) {
    await deleteIntegration(toBeDeletedIntegration.value)
    isDeleteIntegrationModalOpen.value = false
    toBeDeletedIntegration.value = null
  }
}
</script>

<template>
  <div class="flex flex-col nc-workspace-settings-integrations">
    <div class="flex flex-col border-b-1 border-gray-200">
      <div class="flex flex-col gap-1 pt-6 px-6">
        <div class="text-xl">Add an Integration</div>
        <div>Connect tools into your workspace to enhance your workflows.</div>
      </div>
      <div class="flex gap-2 p-6">
        <div class="source-card" @click="addIntegration(integrationType.MySQL)">
          <WorkspaceIntegrationsIcon :integration-type="integrationType.MySQL" size="md" />
          <div class="name">MySQL</div>
        </div>
        <div class="source-card" @click="addIntegration(integrationType.PostgreSQL)">
          <WorkspaceIntegrationsIcon :integration-type="integrationType.PostgreSQL" size="md" />
          <div class="name">PostgreSQL</div>
        </div>
        <a
          class="source-card source-card-link"
          href="https://github.com/nocodb/nocodb/issues"
          target="_blank"
          rel="noreferrer noopener"
        >
          <WorkspaceIntegrationsIcon integration-type="request" size="md" />
          <div class="name">Request New Integration</div>
        </a>
      </div>
    </div>
    <div class="flex flex-col" style="max-width: 1024px">
      <div class="flex gap-1 pt-6 px-6 justify-between items-center">
        <div class="text-xl">Integrations</div>
        <a-input class="!max-w-90 !rounded-md mr-4" placeholder="Search Integrations">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>
      </div>
      <div class="flex p-6">
        <div class="ds-table">
          <div class="ds-table-head">
            <div class="ds-table-row">
              <div class="ds-table-col ds-table-title">Integration name</div>
              <div class="ds-table-col ds-table-type">Integration type</div>
              <div class="ds-table-col ds-table-date">Date added</div>
              <div class="ds-table-col ds-table-actions">Actions</div>
            </div>
          </div>

          <div class="ds-table-body">
            <template v-if="integrations?.length">
              <div v-for="integration of integrations" :key="integration.id" class="ds-table-row">
                <div class="ds-table-col ds-table-title">
                  {{ integration.title }}
                </div>
                <div class="ds-table-col ds-table-type">Database - {{ integration.sub_type }}</div>
                <div class="ds-table-col ds-table-date">
                  {{ timeAgo(integration.created_at) }}
                </div>
                <div class="ds-table-col flex justify-center gap-2 ds-table-actions">
                  <GeneralIcon icon="edit" class="text-gray-500 cursor-pointer" @click="editIntegration(integration)" />
                  <GeneralIcon icon="delete" class="text-error cursor-pointer" @click="openDeleteIntegration(integration)" />
                </div>
              </div>
            </template>

            <div v-else class="ds-table-empty">
              <img src="~assets/img/placeholder/link-records.png" class="!w-[18.5rem] flex-none" />
              <div class="text-2xl text-gray-700 font-bold">No Integrations added</div>
              <div class="text-gray-700 text-center">
                Looks like no integrations have been linked yet.
                <br />
                Add a New Integration using the ‘New Integration’ button.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <GeneralDeleteModal
      v-model:visible="isDeleteIntegrationModalOpen"
      :entity-name="$t('general.integration')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.remove')"
    >
      <template #entity-preview>
        <div
          v-if="toBeDeletedIntegration"
          class="flex flex-row items-center py-2 px-3.25 bg-gray-50 rounded-lg text-gray-700 mb-4"
        >
          <GeneralBaseLogo :source-type="toBeDeletedIntegration.type" />
          <div
            class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          >
            {{ toBeDeletedIntegration.title }}
          </div>
        </div>
      </template>
    </GeneralDeleteModal>
  </div>
</template>

<style lang="scss" scoped>
.source-card-link {
  @apply !text-black !no-underline;
}

.source-card {
  @apply flex items-center border-1 rounded-lg p-3 cursor-pointer hover:bg-gray-50;
  width: 288px;
  .name {
    @apply ml-4 text-md font-semibold;
  }
}

.ds-table {
  @apply w-full border-1 border-gray-200 rounded-lg;
  .ds-table-body {
    @apply flex flex-col;
  }

  .ds-table-head {
    @apply flex items-center border-0 bg-gray-100;
  }

  .ds-table-body {
    @apply flex flex-col;

    .ds-table-empty {
      @apply flex flex-col items-center justify-center p-6;
      img {
        @apply !mb-4 mx-auto;
      }
    }
  }

  .ds-table-head,
  .ds-table-body {
    .ds-table-row {
      @apply grid grid-cols-18 border-b border-gray-100 w-full h-full;

      .ds-table-col {
        @apply flex items-start py-3 mr-2 px-2;

        &.ds-table-title {
          @apply col-span-6;
        }

        &.ds-table-type {
          @apply col-span-4;
        }

        &.ds-table-date {
          @apply col-span-4;
        }

        &.ds-table-actions {
          @apply col-span-4 flex items-center justify-center;
        }
      }
    }
  }
}
</style>
