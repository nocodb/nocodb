<script lang="ts" setup>
import { IntegrationsType, integrationCategoryNeedDefault } from 'nocodb-sdk'
import type { IntegrationType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import dayjs from 'dayjs'

type SortFields = 'title' | 'sub_type' | 'created_at' | 'created_by' | 'source_count'

const { t } = useI18n()

const {
  integrations,
  isLoadingIntegrations,
  deleteConfirmText,
  integrationPaginationData,
  successConfirmModal,
  searchQuery,
  loadDynamicIntegrations,
  loadIntegrations,
  deleteIntegration,
  editIntegration,
  duplicateIntegration,
  getIntegration,
  setDefaultIntegration,
} = useIntegrationStore()

const { $api, $e } = useNuxtApp()

const { allCollaborators } = storeToRefs(useWorkspace())

const { bases } = storeToRefs(useBases())

const { isFeatureEnabled } = useBetaFeatureToggle()

const isDeleteIntegrationModalOpen = ref(false)
const toBeDeletedIntegration = ref<
  | (IntegrationType & {
      sources?: {
        id: string
        alias: string
        project_title: string
        base_id: string
      }[]
    })
  | null
>(null)

const isLoadingGetLinkedSources = ref(false)

const tableWrapper = ref<HTMLDivElement>()

const orderBy = ref<Partial<Record<SortFields, 'asc' | 'desc' | undefined>>>({})

const localCollaborators = ref<User[] | UserType[]>([])

const collaboratorsMap = computed<Map<string, (WorkspaceUserType & { id: string }) | User | UserType>>(() => {
  const map = new Map()

  ;(isEeUI ? allCollaborators.value : localCollaborators.value)?.forEach((coll) => {
    if (coll?.id) {
      map.set(coll.id, coll)
    }
  })
  return map
})

const filteredIntegrations = computed(() =>
  (integrations.value || [])
    .filter((i) => IntegrationsType.Sync !== i.type)
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
            ? dayjs(a.created_at).local().diff(dayjs(b.created_at).local())
            : dayjs(b.created_at).local().diff(dayjs(a.created_at).local())
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
      } else if (orderBy.value.source_count) {
        if (a.source_count !== undefined && b.source_count !== undefined) {
          return orderBy.value.source_count === 'asc' ? a.source_count - b.source_count : b.source_count - a.source_count
        }
      }
      return 0
    }),
)

async function loadConnections(
  page = integrationPaginationData.value.page,
  limit = integrationPaginationData.value.pageSize,
  updateCurrentPage = true,
) {
  try {
    if (updateCurrentPage) {
      integrationPaginationData.value.page = 1
    }

    await loadIntegrations(null, undefined, updateCurrentPage ? 1 : page, limit)
  } catch {}
}

const handleChangePage = async (page: number) => {
  integrationPaginationData.value.page = page
  await loadConnections(undefined, undefined, false)
}

const { onLeft, onRight, onUp, onDown } = usePaginationShortcuts({
  paginationDataRef: integrationPaginationData,
  changePage: handleChangePage,
  isViewDataLoading: isLoadingIntegrations,
})

const openDeleteIntegration = async (source: IntegrationType) => {
  isLoadingGetLinkedSources.value = true

  $e('c:integration:delete')
  deleteConfirmText.value = null
  isDeleteIntegrationModalOpen.value = true
  toBeDeletedIntegration.value = source

  const connectionDetails = await getIntegration(source, {
    includeSources: true,
  })
  toBeDeletedIntegration.value.sources = connectionDetails?.sources || []

  isLoadingGetLinkedSources.value = false
}

const openEditIntegration = (integration: IntegrationType) => {
  if (!isFeatureEnabled(FEATURE_FLAG.DATA_REFLECTION) && integration.sub_type === SyncDataType.NOCODB) {
    return
  }

  editIntegration(integration)
}

const onDeleteConfirm = async () => {
  const isDeleted = await deleteIntegration(toBeDeletedIntegration.value, true)

  if (isDeleted) {
    for (const source of toBeDeletedIntegration.value?.sources || []) {
      if (!source.base_id || !source.id || (source.base_id && !bases.value.get(source.base_id))) {
        continue
      }

      const base = bases.value.get(source.base_id)

      if (!Array.isArray(base?.sources)) {
        continue
      }

      bases.value.set(source.base_id, {
        ...(base || {}),
        sources: [...base.sources.filter((s) => s.id !== source.id)],
      })
    }
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

const handleSearchConnection = useDebounceFn(() => {
  loadConnections()
}, 250)

const isUserDeleted = (userId?: string) => {
  if (!userId) return false

  if (isEeUI) {
    return !!collaboratorsMap.value.get(userId)?.deleted
  } else {
    return !collaboratorsMap.value.get(userId)?.email
  }
}

const getUserNameByCreatedBy = (createdBy: string) => {
  return (
    collaboratorsMap.value.get(createdBy)?.display_name ||
    collaboratorsMap.value.get(createdBy)?.email?.slice(0, collaboratorsMap.value.get(createdBy)?.email?.indexOf('@'))
  )
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
  await loadDynamicIntegrations()
  if (!isEeUI) {
    await Promise.allSettled([!integrations.value.length && loadIntegrations(), loadOrgUsers()])
  } else if (!integrations.value.length) {
    await loadIntegrations()
  }
})
// Keyboard shortcuts for pagination
onKeyStroke('ArrowLeft', onLeft)
onKeyStroke('ArrowRight', onRight)
onKeyStroke('ArrowUp', onUp)
onKeyStroke('ArrowDown', onDown)

const columns = [
  {
    key: 'title',
    title: t('general.name'),
    minWidth: 250,
    dataIndex: 'title',
    showOrderBy: true,
  },
  {
    key: 'sub_type',
    title: t('general.type'),
    minWidth: 98,
    width: 120,
    dataIndex: 'sub_type',
    showOrderBy: true,
  },
  {
    key: 'created_at',
    title: t('labels.dateAdded'),
    basis: '20%',
    minWidth: 200,

    dataIndex: 'created_at',
    showOrderBy: true,
  },
  {
    key: 'created_by',
    title: t('labels.addedBy'),
    minWidth: 250,
    basis: '20%',
    dataIndex: 'created_by',
    showOrderBy: true,
  },
  {
    key: 'source_count',
    title: t('general.usage'),
    width: 120,
    dataIndex: 'source_count',
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    minWidth: 100,
    width: 100,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const customRow = (record: Record<string, any>) => ({
  onclick: () => {
    openEditIntegration(record)
  },
})
</script>

<template>
  <div class="h-full flex flex-col gap-6 nc-workspace-connections nc-content-max-w mx-auto">
    <div class="flex flex-col justify-between gap-2 mx-1">
      <div class="text-sm font-normal text-nc-content-gray-subtle2">
        <div>
          {{ $t('msg.manageConnections') }}
          <a
            target="_blank"
            href="https://nocodb.com/docs/product-docs/integrations/actions-on-connection"
            rel="noopener noreferrer"
          >
            {{ $t('msg.learnMore') }}
          </a>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <a-input
          v-model:value="searchQuery"
          type="text"
          class="nc-search-integration-input !min-w-[300px] !max-w-[400px] nc-input-sm flex-none"
          :placeholder="`${$t('general.search')} ${$t('general.connections').toLowerCase()}`"
          allow-clear
          @input="handleSearchConnection"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
          </template>
        </a-input>
      </div>
    </div>
    <NcTable
      v-model:order-by="orderBy"
      :columns="columns"
      :data="filteredIntegrations"
      :is-data-loading="isLoadingIntegrations"
      sticky-first-column
      :custom-row="customRow"
      class="h-full"
    >
      <template #bodyCell="{ column, record: integration }">
        <div v-if="column.key === 'title'" class="w-full flex items-center gap-3">
          <NcTooltip placement="bottom" class="truncate !text-nc-content-gray font-semibold" show-on-truncate-only>
            <template #title> {{ integration.title }}</template>
            {{ integration.title }}
          </NcTooltip>
          <span v-if="integration.is_private">
            <NcBadge :border="false" class="text-primary !h-4.5 bg-nc-bg-brand text-xs">{{ $t('general.private') }}</NcBadge>
          </span>
        </div>

        <NcTooltip
          v-if="column.key === 'sub_type'"
          placement="bottom"
          class="h-8 w-8 flex-none flex items-center justify-center children:flex-none"
        >
          <template #title> {{ clientTypesMap[integration?.sub_type]?.text || integration?.sub_type }}</template>

          <GeneralIntegrationIcon
            :type="integration.sub_type"
            :size="integration.sub_type === SyncDataType.NOCODB ? 'xxl' : 'lg'"
          />
        </NcTooltip>

        <NcTooltip v-if="column.key === 'created_at'" placement="bottom" show-on-truncate-only>
          <template #title> {{ dayjs(integration.created_at).local().format('DD MMM YYYY') }}</template>

          {{ dayjs(integration.created_at).local().format('DD MMM YYYY') }}
        </NcTooltip>
        <template v-if="column.key === 'created_by'">
          <div v-if="integration.sub_type === SyncDataType.NOCODB" class="flex items-center gap-3">
            <div class="h-8 w-8 grid place-items-center">
              <GeneralIcon icon="nocodb1" />
            </div>
            <div class="text-sm !leading-5 capitalize font-semibold truncate">NocoDB Cloud</div>
          </div>
          <NcTooltip v-else :disabled="!isUserDeleted(integration.created_by)" class="w-full">
            <template #title>
              {{ `User not part of this ${isEeUI ? 'workspace' : 'organisation'} anymore` }}
            </template>
            <div
              v-if="integration.created_by && collaboratorsMap.get(integration.created_by)?.email"
              class="w-full flex gap-3 items-center"
            >
              <GeneralUserIcon
                :user="collaboratorsMap.get(integration.created_by)"
                size="base"
                class="flex-none"
                :class="{
                  '!grayscale': isUserDeleted(integration.created_by),
                }"
                :style="
                  isUserDeleted(integration.created_by)
                    ? {
                        filter: 'grayscale(100%) brightness(115%)',
                      }
                    : {}
                "
              />
              <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                <div class="w-full flex gap-3">
                  <NcTooltip
                    class="text-sm !leading-5 capitalize font-semibold truncate"
                    :class="{
                      'text-nc-content-gray': !isUserDeleted(integration.created_by),
                      'text-nc-content-gray-muted': isUserDeleted(integration.created_by),
                    }"
                    :disabled="isUserDeleted(integration.created_by)"
                    show-on-truncate-only
                    placement="bottom"
                  >
                    <template #title>
                      {{ getUserNameByCreatedBy(integration.created_by) }}
                    </template>
                    {{ getUserNameByCreatedBy(integration.created_by) }}
                  </NcTooltip>
                </div>
                <NcTooltip
                  class="text-xs !leading-4 truncate"
                  :class="{
                    'text-nc-content-gray-subtle2': !isUserDeleted(integration.created_by),
                    'text-nc-content-gray-muted': isUserDeleted(integration.created_by),
                  }"
                  :disabled="isUserDeleted(integration.created_by)"
                  show-on-truncate-only
                  placement="bottom"
                >
                  <template #title>
                    {{ collaboratorsMap.get(integration.created_by)?.email }}
                  </template>
                  {{ collaboratorsMap.get(integration.created_by)?.email }}
                </NcTooltip>
              </div>
            </div>
            <div v-else class="w-full truncate text-nc-content-gray-muted">{{ integration.created_by }}</div>
          </NcTooltip>
        </template>

        <div v-if="column.key === 'action'" @click.stop>
          <NcDropdown placement="bottomRight">
            <NcButton size="small" type="secondary">
              <GeneralIcon icon="threeDotVertical" />
            </NcButton>
            <template #overlay>
              <NcMenu variant="small">
                <NcMenuItem
                  v-if="integration.type && integrationCategoryNeedDefault(integration.type) && !integration.is_default"
                  @click="setDefaultIntegration(integration)"
                >
                  <GeneralIcon class="text-current opacity-80" icon="star" />
                  <span>Set as default</span>
                </NcMenuItem>
                <NcMenuItem
                  :disabled="!isFeatureEnabled(FEATURE_FLAG.DATA_REFLECTION) && integration.sub_type === SyncDataType.NOCODB"
                  @click="openEditIntegration(integration)"
                >
                  <GeneralIcon class="text-current opacity-80" icon="edit" />
                  <span>{{ $t('general.edit') }}</span>
                </NcMenuItem>
                <NcTooltip :disabled="integration?.sub_type !== ClientType.SQLITE">
                  <template #title>
                    Not allowed for type
                    {{
                      integration.sub_type && clientTypesMap[integration.sub_type]
                        ? clientTypesMap[integration.sub_type]?.text
                        : integration.sub_type
                    }}
                  </template>

                  <NcMenuItem
                    :disabled="integration?.sub_type === ClientType.SQLITE || integration?.sub_type === SyncDataType.NOCODB"
                    @click="duplicateIntegration(integration)"
                  >
                    <GeneralIcon class="text-current opacity-80" icon="duplicate" />
                    <span>{{ $t('general.duplicate') }}</span>
                  </NcMenuItem>
                </NcTooltip>
                <template v-if="integration?.sub_type !== SyncDataType.NOCODB">
                  <NcDivider />
                  <NcMenuItem danger @click="openDeleteIntegration(integration)">
                    <GeneralIcon icon="delete" />
                    {{ $t('general.delete') }}
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>
      </template>

      <template #tableFooter>
        <div
          v-if="integrationPaginationData.totalRows"
          class="flex flex-row justify-center items-center bg-nc-bg-gray-extralight min-h-10"
          :class="{
            'pointer-events-none': isLoadingIntegrations,
          }"
        >
          <div class="flex justify-between items-center w-full px-6">
            <div>&nbsp;</div>
            <NcPagination
              v-model:current="integrationPaginationData.page"
              v-model:page-size="integrationPaginationData.pageSize"
              :total="+integrationPaginationData.totalRows"
              show-size-changer
              :use-stored-page-size="false"
              :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
              :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
              :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
              :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
              @update:current="loadConnections(undefined, undefined, false)"
              @update:page-size="loadConnections(integrationPaginationData.page, $event, false)"
            />
            <div class="text-nc-content-gray-muted text-xs">
              {{ integrationPaginationData.totalRows }} {{ integrationPaginationData.totalRows === 1 ? 'record' : 'records' }}
            </div>
          </div>
        </div>
      </template>
    </NcTable>

    <GeneralDeleteModal
      v-model:visible="isDeleteIntegrationModalOpen"
      :entity-name="$t('general.connection')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.delete')"
      :show-default-delete-msg="!isLoadingGetLinkedSources && !toBeDeletedIntegration?.sources?.length"
    >
      <template #entity-preview>
        <template v-if="isLoadingGetLinkedSources">
          <div class="rounded-lg overflow-hidden">
            <a-skeleton-input active class="h-9 !rounded-md !w-full"></a-skeleton-input>
          </div>
          <div class="rounded-lg overflow-hidden mt-2">
            <a-skeleton-input active class="h-9 !rounded-md !w-full"></a-skeleton-input>
          </div>
        </template>
        <div v-else-if="toBeDeletedIntegration" class="w-full flex flex-col text-nc-content-gray">
          <div
            class="flex flex-row items-center py-2 px-3.25 bg-nc-bg-gray-extralight rounded-lg text-nc-content-inverted-secondary mb-4"
          >
            <GeneralIntegrationIcon :type="toBeDeletedIntegration.sub_type" />
            <div
              class="text-ellipsis overflow-hidden select-none w-full pl-3"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            >
              {{ toBeDeletedIntegration.title }}
            </div>
          </div>
          <div
            v-if="toBeDeletedIntegration?.sources?.length"
            class="flex flex-col pb-2 text-small leading-[18px] text-nc-content-gray-muted"
          >
            <div class="mb-1">Following external data sources using this connection will also be removed</div>
            <ul class="!list-disc ml-6 mb-0">
              <li
                v-for="(source, idx) of toBeDeletedIntegration.sources"
                :key="idx"
                class="marker:text-nc-content-gray-muted !marker:(flex items-center !-mt-1)"
              >
                <div class="flex items-center gap-1">
                  <div class="flex items-center">
                    &nbsp;
                    <GeneralProjectIcon
                      type="database"
                      class="!grayscale min-w-5 flex-none -ml-1"
                      :style="{
                        filter: 'grayscale(100%) brightness(115%)',
                      }"
                    />
                  </div>

                  <NcTooltip class="!truncate !max-w-[45%] flex-none" show-on-truncate-only>
                    <template #title>
                      {{ source.project_title }}
                    </template>

                    {{ source.project_title }}
                  </NcTooltip>
                  >
                  <GeneralBaseLogo
                    class="!grayscale min-w-4 flex-none"
                    :style="{
                      filter: 'grayscale(100%) brightness(115%)',
                    }"
                  />

                  <NcTooltip class="truncate !max-w-[45%] capitalize" show-on-truncate-only>
                    <template #title>
                      {{ source.alias }}
                    </template>

                    {{ source.alias }}
                  </NcTooltip>
                </div>
              </li>
            </ul>
            <div class="mt-2">Do you want to proceed anyway?</div>
          </div>
        </div>
      </template>
    </GeneralDeleteModal>

    <NcModal v-model:visible="successConfirmModal.isOpen" centered size="small" @keydown.esc="successConfirmModal.isOpen = false">
      <div class="flex gap-4">
        <div>
          <GeneralIcon icon="circleCheckSolid" class="flex-none !text-nc-content-green-dark mt-0.5 !h-6 !w-6" />
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex">
            <h3 class="!m-0 text-base font-weight-700 flex-1">
              {{ successConfirmModal.title }}
            </h3>
            <NcButton size="xsmall" type="text" @click="successConfirmModal.isOpen = false">
              <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
            </NcButton>
          </div>
          <div class="text-sm text-nc-content-inverted-secondary">
            {{ successConfirmModal.description }}
          </div>

          <a
            target="_blank"
            href="https://nocodb.com/docs/product-docs/data-sources/connect-to-data-source"
            rel="noopener noreferrer"
          >
            Learn more
          </a>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style lang="scss" scoped>
.source-card-link {
  @apply !text-nc-content-gray-extreme !no-underline;

  .nc-new-integration-type-title {
    @apply text-sm font-weight-600 text-nc-content-gray-subtle2;
  }
}

.source-card {
  @apply flex items-center border-1 rounded-lg p-3 cursor-pointer hover:bg-nc-bg-gray-extralight;
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
</style>
