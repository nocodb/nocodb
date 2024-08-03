<script lang="ts" setup>
import { type SourceType, type UserType, type WorkspaceUserType } from 'nocodb-sdk'
import dayjs from 'dayjs'

type SortFields = 'title' | 'sub_type' | 'created_at' | 'created_by' | 'usage'

const { user } = useGlobal()

const {
  integrations,
  isLoadingIntegrations,
  deleteConfirmText,
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

const orderBy = ref<Partial<Record<SortFields, 'asc' | 'desc' | undefined>>>({})

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

const filteredIntegrations = computed(() =>
  (integrations.value || [])
    .filter((i) => i?.title?.toLowerCase()?.includes(searchQuery.value.toLowerCase()))
    .sort((a, b) => {
      if (orderBy.value.title) {
        if (a.title && b.title) {
          return orderBy.value.title === 'asc' ? (a.title < b.title ? -1 : 1) : a.title > b.title ? -1 : 1
        }
      } else if (orderBy.value.sub_type) {
        if (a.sub_type && b.sub_type) {
          return orderBy.value.sub_type === 'asc' ? (a.sub_type < b.sub_type ? -1 : 1) : a.sub_type > b.sub_type ? -1 : 1
        }
      } else if (orderBy.value.created_at) {
        if (a?.created_at && b?.created_at) {
          return orderBy.value.created_at === 'asc'
            ? dayjs(a.created_at).local().isBefore(dayjs(b.created_at).local())
              ? -1
              : 1
            : dayjs(a.created_at).local().isAfter(dayjs(b.created_at).local())
            ? -1
            : 1
        }
      } else if (orderBy.value.created_by) {
        if (
          a.created_by &&
          b.created_by &&
          collaboratorsMap.value.get(a.created_by) &&
          collaboratorsMap.value.get(b.created_by)
        ) {
          return orderBy.value.created_by === 'asc'
            ? collaboratorsMap.value.get(a.created_by)?.email < collaboratorsMap.value.get(b.created_by)?.email
              ? -1
              : 1
            : collaboratorsMap.value.get(a.created_by)?.email > collaboratorsMap.value.get(b.created_by)?.email
            ? -1
            : 1
        }
      }
      //  else if (orderBy.value.usage) {
      //   if (a.usage !== undefined && b.usage !== undefined) {
      //     return orderBy.value.usage === 'asc' ? (a.usage - b.usage) : (b.usage - a.usage)
      //   }
      // }
      return 0
    }),
)

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

const updateOrderBy = (field: SortFields) => {
  if (!integrations.value?.length) return

  // Only single field sort supported, other old field sort config will reset
  if (orderBy.value?.[field] === 'asc') {
    orderBy.value = {
      [field]: 'desc',
    }
  } else if (orderBy.value?.[field] === 'desc') {
    orderBy.value = {
      [field]: undefined,
    }
  } else {
    orderBy.value = {
      [field]: 'asc',
    }
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
  <div class="h-full flex flex-col gap-6 nc-workspace-connections">
    <div class="flex items-center justify-between gap-3 mx-1">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="nc-search-integration-input !max-w-90 nc-input-sm"
        :placeholder="`${$t('general.search')} ${$t('general.connections').toLowerCase()}`"
        allow-clear
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
        </template>
      </a-input>
    </div>
    <div
      class="table-container relative min-h-[500px]"
      :class="{
        'mb-6': isEeUI,
      }"
    >
      <div
        ref="tableWrapper"
        class="nc-workspace-integration-table relative nc-scrollbar-thin !overflow-auto max-h-full"
        :class="{
          'h-full': filteredIntegrations?.length,
        }"
      >
        <table class="!sticky top-0 z-10 w-full">
          <thead>
            <tr>
              <th
                class="cell-title !hover:bg-gray-100 select-none cursor-pointer"
                :class="{
                  'cursor-not-allowed': !filteredIntegrations?.length,
                  '!text-gray-700': orderBy.title,
                }"
                @click="updateOrderBy('title')"
              >
                <div class="flex items-center gap-3">
                  <div>Name</div>
                  <GeneralIcon
                    v-if="orderBy.title"
                    icon="chevronDown"
                    class="flex-none"
                    :class="{
                      'transform rotate-180': orderBy?.title === 'asc',
                    }"
                  />
                  <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                </div>
              </th>
              <th
                class="cell-type !hover:bg-gray-100 select-none cursor-pointer"
                :class="{
                  'cursor-not-allowed': !filteredIntegrations?.length,
                  '!text-gray-700': orderBy.sub_type,
                }"
                @click="updateOrderBy('sub_type')"
              >
                <div class="flex items-center gap-3">
                  <div>Type</div>
                  <GeneralIcon
                    v-if="orderBy.sub_type"
                    icon="chevronDown"
                    class="flex-none"
                    :class="{
                      'transform rotate-180': orderBy.sub_type === 'asc',
                    }"
                  />
                  <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                </div>
              </th>

              <th
                class="cell-created-date !hover:bg-gray-100 select-none cursor-pointer"
                :class="{
                  'cursor-not-allowed': !filteredIntegrations?.length,
                  '!text-gray-700': orderBy.created_at,
                }"
                @click="updateOrderBy('created_at')"
              >
                <div>
                  <div class="flex items-center gap-3">
                    <div>Date added</div>
                    <GeneralIcon
                      v-if="orderBy.created_at"
                      icon="chevronDown"
                      class="flex-none"
                      :class="{
                        'transform rotate-180': orderBy.created_at === 'asc',
                      }"
                    />
                    <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                  </div>
                </div>
              </th>
              <th
                class="cell-added-by !hover:bg-gray-100 select-none cursor-pointer"
                :class="{
                  'cursor-not-allowed': !filteredIntegrations?.length,
                  '!text-gray-700': orderBy.created_by,
                }"
                @click="updateOrderBy('created_by')"
              >
                <div class="flex items-center gap-3">
                  <div>Added by</div>
                  <GeneralIcon
                    v-if="orderBy.created_by"
                    icon="chevronDown"
                    class="flex-none"
                    :class="{
                      'transform rotate-180': orderBy.created_by === 'asc',
                    }"
                  />
                  <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                </div>
              </th>
              <!-- <th
                class="cell-usage !hover:bg-gray-100 select-none cursor-pointer"
                :class="{
                  'cursor-not-allowed': !filteredIntegrations?.length,
                }"
                @click="updateOrderBy('usage')"
              >
                <div class="flex items-center gap-3">
                  <div>Usage</div>
                  <GeneralIcon
                    v-if="orderBy?.usage"
                    icon="chevronDown"
                    class="flex-none"
                    :class="{
                      'transform rotate-180': orderBy?.usage === 'asc',
                    }"
                  />
                  <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                </div>
              </th> -->
              <th class="cell-actions">
                <div>Actions</div>
              </th>
            </tr>
          </thead>
        </table>
        <template v-if="filteredIntegrations?.length">
          <table class="h-full max-h-[calc(100%_-_55px)] w-full">
            <tbody>
              <tr v-for="integration of filteredIntegrations" :key="integration.id" @click="editIntegration(integration)">
                <td class="cell-title">
                  <div class="flex items-center gap-3">
                    <NcTooltip placement="bottom" class="truncate" show-on-truncate-only>
                      <template #title> {{ integration.title }}</template>
                      {{ integration.title }}
                    </NcTooltip>
                    <span v-if="integration.is_private">
                      <NcBadge :border="false" class="text-primary !h-4.5 bg-brand-50 text-xs">{{
                        $t('general.private')
                      }}</NcBadge>
                    </span>
                  </div>
                </td>
                <td class="cell-type">
                  <div class="flex">
                    <NcBadge rounded="lg" class="flex items-center gap-2 px-2 py-1 !h-7 truncate">
                      <WorkspaceIntegrationsIcon
                        v-if="integration.sub_type"
                        :integration-type="integration.sub_type"
                        size="xs"
                        class="!p-0 !bg-transparent"
                      />
                      <NcTooltip placement="bottom" show-on-truncate-only class="text-sm truncate">
                        <template #title> {{ clientTypesMap[integration?.sub_type]?.text || integration?.sub_type }}</template>

                        {{
                          integration.sub_type && clientTypesMap[integration.sub_type]
                            ? clientTypesMap[integration.sub_type]?.text
                            : integration.sub_type
                        }}
                      </NcTooltip>
                    </NcBadge>
                  </div>
                </td>
                <td class="cell-created-date">
                  <div>
                    <NcTooltip placement="bottom" show-on-truncate-only>
                      <template #title> {{ dayjs(integration.created_at).local().format('DD MMM YYYY') }}</template>

                      {{ dayjs(integration.created_at).local().format('DD MMM YYYY') }}
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
                  <div class="flex justify-end">
                    <NcDropdown v-if="user?.id === integration.created_by" placement="bottomRight">
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
          <div class="text-2xl text-gray-700 font-bold">No connections added</div>
          <div class="text-gray-700 text-center">Looks like no connections have been linked yet.</div>
        </div>
      </div>
    </div>

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

:deep(.ant-input-affix-wrapper.nc-search-integration-input) {
  &:not(:has(.ant-input-clear-icon-hidden)):has(.ant-input-clear-icon) {
    @apply border-[var(--ant-primary-5)];
  }
}

.nc-new-integration-type-wrapper {
  @apply flex flex-col gap-3;
}

.table-container {
  @apply border-1 border-gray-200 rounded-lg overflow-hidden w-full;

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
      @apply w-full;
      th {
        @apply bg-gray-50 text-sm text-gray-500 font-weight-500;

        &.cell-title {
          @apply sticky left-0 z-4 bg-gray-50;
        }
      }
    }

    tbody {
      @apply w-full;
      tr {
        @apply cursor-pointer;

        td {
          @apply text-sm text-gray-600;

          &.cell-title {
            @apply sticky left-0 z-4 bg-white !text-gray-800 font-semibold;
          }
        }
      }
    }

    tr {
      @apply h-[54px] flex border-b-1 border-gray-200 w-full;

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
          @apply flex-1 min-w-[252px] sticky left-0 z-5;
        }

        &.cell-added-by {
          @apply basis-[20%] min-w-[252px];
        }

        &.cell-type {
          @apply basis-[20%] min-w-[180px];
        }

        &.cell-created-date {
          @apply basis-[20%] min-w-[160px];
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
