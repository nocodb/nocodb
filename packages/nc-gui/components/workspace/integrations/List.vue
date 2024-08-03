<script lang="ts" setup>
import { type SourceType, type UserType, type WorkspaceUserType } from 'nocodb-sdk'
import dayjs from 'dayjs'

const { user } = useGlobal()
const {
  pageMode,
  integrations,
  isLoadingIntegrations,
  deleteConfirmText,
  IntegrationsPageMode,
  loadIntegrations,
  deleteIntegration,
  editIntegration,
  duplicateIntegration,
} = useIntegrationStore()

const { $api, $e } = useNuxtApp()

const { collaborators } = storeToRefs(useWorkspace())

const isDeleteIntegrationModalOpen = ref(false)
const toBeDeletedIntegration = ref<SourceType | null>(null)

const tableWrapper = ref<HTMLDivElement>()

const searchQuery = ref<string>('')

const filteredIntegrations = computed(() =>
  (integrations.value || []).filter((i) => i?.title?.toLowerCase()?.includes(searchQuery.value.toLowerCase())),
)

const localCollaborators = ref<User[] | UserType[]>([])

const collaboratorsMap = computed<Map<string, (WorkspaceUserType & { id: string }) | User | UserType>>(() => {
  const map = new Map()

  ;(isEeUI ? collaborators.value : localCollaborators.value)?.forEach((coll) => {
    if (coll?.id) {
      map.set(coll.id, coll)
    }
  })
  return map
})

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

const loadOrgUsers = async () => {
  try {
    const response: any = await $api.orgUsers.list()

    if (!response?.list) return

    localCollaborators.value = response.list as UserType[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

useEventListener(tableWrapper, 'scroll', () => {
  const stickyHeaderCell = tableWrapper.value?.querySelector('th.cell-title')
  const nonStickyHeaderFirstCell = tableWrapper.value?.querySelector('th.cell-type')

  if (!stickyHeaderCell?.getBoundingClientRect().right || !nonStickyHeaderFirstCell?.getBoundingClientRect().left) {
    return
  }

  if (nonStickyHeaderFirstCell?.getBoundingClientRect().left < stickyHeaderCell?.getBoundingClientRect().right) {
    tableWrapper.value?.classList.add('sticky-shadow')
  } else {
    tableWrapper.value?.classList.remove('sticky-shadow')
  }
})

onMounted(async () => {
  if (!isEeUI) {
    await Promise.allSettled([loadIntegrations(), loadOrgUsers()])
  } else {
    await loadIntegrations()
  }
})
</script>

<template>
  <div class="h-full flex flex-col gap-6 pt-6 nc-workspace-settings-integrations max-w-[fit-content]">
    <div class="flex items-center justify-between gap-3 mx-2">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="!max-w-90 nc-input-sm"
        placeholder="Search an Integration"
        allow-clear
      >
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
    <div class="table-container relative min-h-[500px]">
      <div ref="tableWrapper" class="nc-workspace-integration-table relative nc-scrollbar-thin !overflow-auto h-full min-h-[500px]">
        <table class="!sticky top-0 z-10">
          <thead>
            <tr>
              <th class="cell-title">
                <div>Integration name</div>
              </th>
              <th class="cell-type">
                <div>Type</div>
              </th>
              <th class="cell-created-date">
                <div>Date added</div>
              </th>
              <th class="cell-added-by">
                <div>Added by</div>
              </th>
              <!-- <th class="cell-usage">
                <div>Usage</div>
              </th> -->
              <th class="cell-actions">
                <div>Actions</div>
              </th>
            </tr>
          </thead>
        </table>
        <template v-if="filteredIntegrations?.length">
          <table class="h-full">
            <tbody>
              <tr v-for="integration of filteredIntegrations" :key="integration.id" @click="editIntegration(integration)">
                <td class="cell-title">
                  <div class="flex items-center gap-3">
                    <NcTooltip placement="bottom" class="truncate" show-on-truncate-only>
                      <template #title> {{ integration.title }}</template>
                      {{ integration.title }}
                    </NcTooltip>
                    <span v-if="!integration.is_private">
                      <NcBadge :border="false" class="text-primary bg-brand-50 text-sm">Shared</NcBadge>
                    </span>
                  </div>
                </td>
                <td class="cell-type">
                  <div class="flex">
                    <NcBadge rounded="lg" class="flex items-center gap-2 px-2 py-1 !h-7 truncate">
                      <WorkspaceIntegrationsIcon
                        :integration-type="integration.sub_type"
                        size="xs"
                        class="!p-0 !bg-transparent"
                      />
                      <NcTooltip placement="bottom" show-on-truncate-only class="text-sm truncate">
                        <template #title> {{ integration.sub_type }}</template>

                        {{ integration.sub_type }}
                      </NcTooltip>
                    </NcBadge>
                  </div>
                </td>
                <td class="cell-created-date">
                  <div>
                    <NcTooltip placement="bottom" show-on-truncate-only>
                      <template #title> {{ dayjs(integration.created_at).format('DD MMM YYYY') }}</template>

                      {{ dayjs(integration.created_at).format('DD MMM YYYY') }}
                    </NcTooltip>
                  </div>
                </td>
                <td class="cell-added-by">
                  <div>
                    <div
                      v-if="integration.created_by && collaboratorsMap.get(integration.created_by)?.email"
                      class="w-full flex gap-3 items-center"
                    >
                      <GeneralUserIcon
                        :email="collaboratorsMap.get(integration.created_by)?.email"
                        size="base"
                        class="flex-none"
                      />
                      <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                        <div class="w-full flex gap-3">
                          <NcTooltip
                            class="text-sm !leading-5 text-gray-800 capitalize font-semibold truncate"
                            show-on-truncate-only
                            placement="bottom"
                          >
                            <template #title>
                              {{
                                collaboratorsMap.get(integration.created_by)?.display_name ||
                                collaboratorsMap
                                  .get(integration.created_by)
                                  ?.email?.slice(0, collaboratorsMap.get(integration.created_by)?.email.indexOf('@'))
                              }}
                            </template>
                            {{
                              collaboratorsMap.get(integration.created_by)?.display_name ||
                              collaboratorsMap
                                .get(integration.created_by)
                                ?.email?.slice(0, collaboratorsMap.get(integration.created_by)?.email.indexOf('@'))
                            }}
                          </NcTooltip>
                        </div>
                        <NcTooltip class="text-xs !leading-4 text-gray-600 truncate" show-on-truncate-only placement="bottom">
                          <template #title>
                            {{ collaboratorsMap.get(integration.created_by)?.email }}
                          </template>
                          {{ collaboratorsMap.get(integration.created_by)?.email }}
                        </NcTooltip>
                      </div>
                    </div>
                    <template v-else>{{ integration.created_by }} </template>
                  </div>
                </td>
                <!-- <td class="cell-usage">
                  <div></div>
                </td> -->
                <td class="cell-actions" @click.stop>
                  <div>
                    <NcDropdown v-if="user?.id === integration.created_by">
                      <NcButton size="small" type="secondary">
                        <GeneralIcon icon="threeDotVertical" />
                      </NcButton>
                      <template #overlay>
                        <NcMenu>
                          <NcMenuItem @click="editIntegration(integration)">
                            <GeneralIcon class="text-gray-800" icon="edit" />
                            <span>{{ $t('general.edit') }}</span>
                          </NcMenuItem>
                          <NcMenuItem @click="duplicateIntegration(integration)">
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

      <div
        v-show="isLoadingIntegrations"
        class="flex items-center justify-center absolute left-0 top-0 w-full h-full z-10 pb-10 pointer-events-none"
      >
        <div class="flex flex-col justify-center items-center gap-2">
          <GeneralLoader size="xlarge" />
          <span class="text-center">{{ $t('general.loading') }}</span>
        </div>
      </div>
      <div
        v-if="!isLoadingIntegrations && (!integrations?.length || !filteredIntegrations.length)"
        class="flex-none integration-table-empty flex items-center justify-center py-8 px-6"
      >
        <div
          v-if="integrations?.length && !filteredIntegrations.length"
          class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center"
        >
          <img
            src="~assets/img/placeholder/no-search-result-found.png"
            class="!w-[164px] flex-none"
            alt="No search results found"
          />

          {{ $t('title.noResultsMatchedYourSearch') }}
        </div>

        <div v-else class="flex-none text-center flex flex-col items-center gap-3">
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

    <WorkspaceIntegrationsNewAvailableList></WorkspaceIntegrationsNewAvailableList>
    <WorkspaceIntegrationsEditOrAdd></WorkspaceIntegrationsEditOrAdd>

    <GeneralDeleteModal
      v-model:visible="isDeleteIntegrationModalOpen"
      :entity-name="$t('general.integration')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.delete')"
    >
      <template #entity-preview>
        <span v-if="deleteConfirmText">{{ deleteConfirmText }}</span>
        <div
          v-else-if="toBeDeletedIntegration"
          class="flex flex-row items-center py-2 px-3.25 bg-gray-50 rounded-lg text-gray-700 mb-4"
        >
          <WorkspaceIntegrationsIcon :integration-type="toBeDeletedIntegration.sub_type" size="xs" class="!p-0 !bg-transparent" />
          <div
            class="text-ellipsis overflow-hidden select-none w-full pl-3"
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
  @apply border-1 border-gray-200 rounded-lg overflow-hidden max-w-[fit-content] mb-6;

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
      @apply h-[54px] flex border-b-1 border-gray-200;

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

        &.cell-added-by {
          @apply w-[220px];
        }

        &.cell-type {
          @apply w-[180px];
        }

        &.cell-created-date {
          @apply w-[150px];
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
