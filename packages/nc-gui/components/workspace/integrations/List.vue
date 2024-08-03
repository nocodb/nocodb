<script lang="ts" setup>
import { type SourceType } from 'nocodb-sdk'

const {
  pageMode,
  integrations,
  loadIntegrations,
  integrationType,
  addIntegration,
  deleteIntegration,
  editIntegration,
  deleteConfirmText,
  IntegrationsPageMode,
} = useIntegrationStore()

const { $e } = useNuxtApp()

onMounted(async () => {
  await loadIntegrations()
})

const isDeleteIntegrationModalOpen = ref(false)
const toBeDeletedIntegration = ref<SourceType | null>(null)

const openDeleteIntegration = (source: IntegrationType) => {
  $e('c:integration:delete')
  deleteConfirmText.value = null
  isDeleteIntegrationModalOpen.value = true
  toBeDeletedIntegration.value = source
}

const onDeleteConfirm = async () => {
  if (toBeDeletedIntegration.value && (await deleteIntegration(toBeDeletedIntegration.value, !!deleteConfirmText.value))) {
    isDeleteIntegrationModalOpen.value = false
    toBeDeletedIntegration.value = null
  } else {
    setTimeout(() => {
      isDeleteIntegrationModalOpen.value = true
    }, 100)
  }
}
</script>

<template>
  <div class="h-full flex flex-col gap-6 pt-6 nc-workspace-settings-integrations">
    <div class="flex flex-col border-b-1 border-gray-200">
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
    <div class="max-w-[1204px] flex items-center justify-between gap-3 mx-2">
      <a-input type="text" class="!max-w-90 nc-input-sm" placeholder="Search an Integration" allow-clear>
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
        </template>
      </a-input>
      <NcButton size="small" class="flex-none" @click="pageMode = IntegrationsPageMode.LIST">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="plus" />
          New Integration
        </div>
      </NcButton>
    </div>
    <div class="table-container relative">
      <div
        ref="tableWrapper"
        class="nc-workspace-integration-table max-h-[calc(100%_-_40px)] relative nc-scrollbar-thin !overflow-auto"
      >
        <table class="!sticky top-0 z-10">
          <thead>
            <tr>
              <th class="cell-title">
                <div>Integration name</div>
              </th>
              <th class="cell-type">
                <div>Integration type</div>
              </th>
              <th class="cell-created-date">
                <div>Date added</div>
              </th>
              <th class="cell-added-by">
                <div>Added by</div>
              </th>
              <th class="cell-usage">
                <div>usage</div>
              </th>
              <th class="cell-actions">
                <div>Actions</div>
              </th>
            </tr>
          </thead>
        </table>
        <template v-if="integrations?.length">
          <table class="min-h-[500px]">
            <tbody>
              <tr v-for="integration of integrations" :key="integration.id">
                <td class="cell-title">
                  <div>
                    <NcTooltip placement="bottom">
                      <template #title> {{ integration.title }}</template>
                      {{ integration.title }}
                    </NcTooltip>
                  </div>
                </td>
                <td class="cell-type">
                  <div>
                    <NcTooltip placement="bottom">
                      <template #title>Database - {{ integration.sub_type }}</template>

                      Database - {{ integration.sub_type }}
                    </NcTooltip>
                  </div>
                </td>
                <td class="cell-created-date">
                  <div>
                    <NcTooltip placement="bottom">
                      <template #title> {{ timeAgo(integration.created_at) }}</template>

                      {{ timeAgo(integration.created_at) }}
                    </NcTooltip>
                  </div>
                </td>
                <td class="cell-added-by">
                  <div>fdsa</div>
                </td>
                <td class="cell-usage">
                  <div></div>
                </td>
                <td class="cell-actions">
                  <div>
                    <NcDropdown>
                      <NcButton size="small" type="secondary">
                        <GeneralIcon icon="threeDotVertical" />
                      </NcButton>
                      <template #overlay>
                        <NcMenu>
                          <NcMenuItem @click="editIntegration(integration)">
                            <GeneralIcon class="text-gray-800" icon="edit" />
                            <span>{{ $t('general.edit') }}</span>
                          </NcMenuItem>
                          <NcMenuItem>
                            <GeneralIcon class="text-gray-800" icon="duplicate" />
                            <span>{{ $t('general.duplicate') }}</span>
                          </NcMenuItem>
                          <NcDivider />
                          <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="openDeleteIntegration(integration)">
                            <GeneralIcon icon="delete" />
                            {{ $t('general.delete') }}
                          </NcMenuItem>
                        </NcMenu>
                      </template>
                    </NcDropdown>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
      <!-- Todo: add loading state  -->
      <div
        v-show="false"
        class="flex items-center justify-center absolute left-0 top-0 w-full h-full z-10 pb-10 pointer-events-none"
      >
        <div class="flex flex-col justify-center items-center gap-2">
          <GeneralLoader size="xlarge" />
          <span class="text-center">{{ $t('general.loading') }}</span>
        </div>
      </div>
      <div v-if="!integrations?.length" class="flex-none integration-table-empty flex items-center justify-center py-8 px-6">
        <div class="flex-none text-center flex flex-col items-center gap-3">
          <img src="~assets/img/placeholder/link-records.png" class="!w-[18.5rem] flex-none" />
          <div class="text-2xl text-gray-700 font-bold">No Integrations added</div>
          <div class="text-gray-700 text-center">Looks like no integrations have been linked yet.</div>
          <NcButton size="small" class="flex-none" @click="pageMode = IntegrationsPageMode.LIST">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              New Integration
            </div>
          </NcButton>
        </div>
      </div>
    </div>

    <WorkspaceIntegrationsAvailableList></WorkspaceIntegrationsAvailableList>
    <WorkspaceIntegrationsEditOrAdd></WorkspaceIntegrationsEditOrAdd>

    <GeneralDeleteModal
      v-model:visible="isDeleteIntegrationModalOpen"
      :entity-name="$t('general.integration')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.remove')"
    >
      <template #entity-preview>
        <span v-if="deleteConfirmText">{{ deleteConfirmText }}</span>
        <div
          v-else-if="toBeDeletedIntegration"
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
  .nc-new-integration-type-title {
    @apply text-sm font-weight-600 text-gray-600;
  }
}

.source-card {
  @apply flex items-center border-1 rounded-lg p-3 cursor-pointer hover:bg-gray-50;
  width: 288px;
  .name {
    @apply ml-4 text-md font-semibold;
  }
}

.nc-new-integration-type-wrapper {
  @apply flex flex-col gap-3;
}

.table-container {
  @apply border-1 border-gray-200 rounded-lg overflow-hidden max-w-[1204px];

  .nc-workspace-integration-table {
    &.sticky-shadow {
      th,
      td {
        &.cell-title {
          @apply border-r-1 border-gray-200;
        }
      }
    }
    &:not(.sticky-shadow) {
      th,
      td {
        &.cell-title {
          @apply border-r-1 border-transparent;
        }
      }
    }
    thead {
      th {
        @apply bg-gray-50 text-sm text-gray-500 font-weight-500;

        &.cell-title {
          @apply sticky left-0 z-4 bg-gray-50;
        }
      }
    }

    tbody {
      tr {
        @apply cursor-pointer;

        .td {
          @apply text-small leading-[18px] text-gray-600;
        }

        td {
          &.cell-title {
            @apply sticky left-0 z-4 bg-white;
          }
        }
      }
    }

    tr {
      @apply h-[54px] flex border-b-1  border-gray-200;

      &:hover td {
        @apply !bg-gray-50;
      }

      &.selected td {
        @apply !bg-gray-50;
      }

      th,
      td {
        @apply h-full;

        & > div {
          @apply px-6 h-full flex items-center;
        }

        &.cell-title {
          @apply w-[252px] sticky left-0 z-5;
        }

        &.cell-type,
        &.cell-created-date,
        &.cell-added-by {
          @apply w-[252px];
        }
        &.cell-usage {
          @apply w-[96px];
        }

        &.cell-actions {
          @apply w-[100px];
        }
      }
    }
  }
}

.cell-header {
  @apply text-xs font-semibold text-gray-500;
}
</style>
