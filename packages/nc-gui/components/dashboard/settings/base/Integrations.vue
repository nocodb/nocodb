<script setup lang="ts">
import dayjs from 'dayjs'
import { DefaultEnvironmentKey, IntegrationCategoryType, integrationSupportsEnvironments } from 'nocodb-sdk'
import type { EnvironmentType, IntegrationType } from 'nocodb-sdk'
import type { IntegrationItemType, NcTableColumnProps } from '#imports'

interface Props {
  baseId: string
}

const props = withDefaults(defineProps<Props>(), {})

const { baseId } = toRefs(props)

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const { user } = useGlobal()

const basesStore = useBases()
const { basesUser } = storeToRefs(basesStore)

const { linkedIntegrations, isLoading, isLoaded, loadLinkedIntegrations, linkIntegration, unlinkIntegration } =
  useBaseIntegrations()

const canManage = computed(() => isUIAllowed('baseIntegrationCreate'))

// Integration store (provided by View.vue)
const {
  addIntegration,
  editIntegration,
  eventBus,
  isFromIntegrationPage,
  loadDynamicIntegrations,
  integrationsRefreshKey,
  availableSyncAuthIntegrationSubtypes,
} = useIntegrationStore()

const { isEEFeatureBlocked, isEnvironmentBlocked, environmentUpgradeFeature } = useEeConfig()

const { isSyncFeatureEnabled } = storeToRefs(useSyncStore())

// Environments (base scope resolves automatically from activeProjectId).
const environmentsStore = useEnvironments()

const { environments } = storeToRefs(environmentsStore)

const { loadEnvironments } = environmentsStore

// Per-user integrations have no shared credential — each member connects
// their own account per environment.
function isPerUserIntegration(integration: IntegrationType) {
  return integration.credential_mode === 'per_user'
}

// Shared integrations: Production is always configured (it IS the
// integration's own config); other stages only when an override exists.
// Per-user integrations: the dot reflects YOUR OWN connection state for that
// environment (`connected_environment_ids` is attached per caller).
function isEnvConfigured(integration: IntegrationType, env: EnvironmentType) {
  if (isPerUserIntegration(integration)) {
    return ((integration as any).connected_environment_ids ?? []).includes(env.id!)
  }
  if (env.key === DefaultEnvironmentKey.PRODUCTION) return true
  return ((integration as any).environments ?? []).some((c: { fk_environment_id: string }) => c.fk_environment_id === env.id)
}

const canEditIntegration = (integration: IntegrationType) => {
  return canManage.value && integration.created_by === user.value?.id
}

const canUnlinkIntegration = (integration: IntegrationType) => {
  return isUIAllowed('baseIntegrationUnlink') && integration.is_restricted && !integration.is_global
}

const hasAnyAction = (integration: IntegrationType) => {
  return canEditIntegration(integration) || canUnlinkIntegration(integration)
}

// View mode: 'main' (single-page with cards + categories) or 'all-connections' (full table)
const viewMode = ref<'main' | 'all-connections'>('main')

// Non-managers can't create integrations — the catalog is pointless for them,
// so they land on (and stay in) the connections list, where per-user
// integrations offer their connect action.
watchEffect(() => {
  if (!canManage.value && viewMode.value === 'main') {
    viewMode.value = 'all-connections'
  }
})

const searchQuery = ref('')
const connectionsSearchQuery = ref('')

const mainSearchInputRef = ref<HTMLInputElement>()
const connectionsSearchInputRef = ref<HTMLInputElement>()

const filteredAllConnections = computed(() => {
  if (!connectionsSearchQuery.value.trim()) return linkedIntegrations.value

  const query = connectionsSearchQuery.value.trim().toLowerCase()
  return linkedIntegrations.value.filter((i) => i.title?.toLowerCase().includes(query))
})

// Filtered linked integrations based on search
const filteredLinkedIntegrations = computed(() => {
  if (!searchQuery.value.trim()) return linkedIntegrations.value

  const query = searchQuery.value.trim().toLowerCase()
  return linkedIntegrations.value.filter((i) => i.title?.toLowerCase().includes(query))
})

// Build category map for the card grid
const integrationsMap = computed(() => {
  // Force re-evaluation when dynamic integrations are loaded
  // eslint-disable-next-line no-unused-expressions
  integrationsRefreshKey.value

  const map: Record<string, { title: string; value: string; list: IntegrationItemType[] }> = {}

  for (const cat of integrationCategories) {
    if (isEEFeatureBlocked.value) {
      if (cat.value !== IntegrationCategoryType.DATABASE) continue
    } else if (
      cat.value !== IntegrationCategoryType.DATABASE &&
      cat.value !== IntegrationCategoryType.AI &&
      cat.value !== IntegrationCategoryType.AUTH
    ) {
      continue
    }
    if (!cat.isAvailable) continue

    const query = searchQuery.value.trim().toLowerCase()

    map[cat.value] = {
      title: cat.title,
      value: cat.value,
      list: allIntegrations.filter(
        (i) =>
          i.type === cat.value &&
          i.isAvailable &&
          // OSS-only (e.g. SQLite) only on free, self-hosted (CE + unlicensed On-Prem)
          (isEEFeatureBlocked.value || !i.isOssOnly) &&
          // EE-only (e.g. MSSQL, Oracle) hidden in CE; in EE gated by their paid add-on
          (isEeUI || !i.isEeOnly) &&
          i.sub_type !== SyncDataType.NOCODB &&
          // AUTH category: only show integrations available for sync auth
          (cat.value !== IntegrationCategoryType.AUTH ||
            !isSyncFeatureEnabled.value ||
            availableSyncAuthIntegrationSubtypes.value.includes(i.sub_type)) &&
          (!query || t(i.title).toLowerCase().includes(query)),
      ),
    }
  }
  return map
})

const handleAddIntegration = async (integration: IntegrationItemType) => {
  if (!integration.isAvailable) return
  await addIntegration(integration)
}

// Auto-link newly created integrations to this base
const unsubscribeEventBus = eventBus.on(async (event: string, payload: any) => {
  if (event === IntegrationStoreEvents.INTEGRATION_ADD && payload?.id) {
    await linkIntegration(baseId.value, payload.id)
    viewMode.value = 'all-connections'
    await reload()
  }

  // The caller connected/disconnected their own account — reflect it on the
  // matching row so the env dots update without a page reload.
  if (event === IntegrationStoreEvents.USER_CONNECTION_UPDATE && payload?.id) {
    const row = linkedIntegrations.value.find((i) => i.id === payload.id)
    if (row) {
      ;(row as IntegrationType & { connected_environment_ids?: string[] }).connected_environment_ids =
        payload.connected_environment_ids ?? []
    }
  }
})

onBeforeUnmount(() => {
  unsubscribeEventBus()
})

const collaboratorsMap = computed<Map<string, any>>(() => {
  const map = new Map()
  basesUser.value.get(baseId.value)?.forEach((user) => {
    if (user?.id) map.set(user.id, user)
  })
  return map
})

const getUserName = (userId: string) => {
  const user = collaboratorsMap.value.get(userId)
  if (!user) return userId
  return user.display_name || user.email?.split('@')[0] || userId
}

const linkedColumns = computed<NcTableColumnProps[]>(
  () =>
    [
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
      // Environments column — same semantics as the workspace connections list.
      ...(isEeUI
        ? [
            {
              key: 'environments',
              title: t('title.environments'),
              minWidth: 120,
              width: 140,
            },
          ]
        : []),
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
        minWidth: 200,
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
      // Base access + row actions are manager-only surfaces.
      ...(canManage.value
        ? [
            {
              key: 'base_access',
              title: t('labels.baseAccess'),
              minWidth: 140,
              width: 160,
            },
            {
              key: 'action',
              title: t('labels.actions'),
              minWidth: 100,
              width: 100,
              justify: 'justify-end',
            },
          ]
        : []),
    ] as NcTableColumnProps[],
)

const orderBy = ref<Record<string, 'asc' | 'desc' | undefined>>({})

async function reload() {
  if (!baseId.value) return
  await loadLinkedIntegrations(baseId.value)
}

async function handleUnlink(integrationId: string) {
  await unlinkIntegration(baseId.value, integrationId)
}

const handleEdit = (integration: IntegrationType) => {
  editIntegration(integration, true, baseId.value)
}

// Per-user integrations open for everyone (the modal offers the caller's
// connect card); everything else opens only for its creator, as before.
const customRow = (record: Record<string, any>) => ({
  onclick: () => {
    if (record.credential_mode === 'per_user' || canEditIntegration(record as IntegrationType)) {
      handleEdit(record as IntegrationType)
    }
  },
})

// Connection cards: show max 6
const maxVisibleCards = 6

const visibleLinkedConnections = computed(() => {
  return filteredLinkedIntegrations.value.slice(0, maxVisibleCards)
})

const overflowCount = computed(() => {
  return Math.max(0, filteredLinkedIntegrations.value.length - maxVisibleCards)
})

const isSearchEmpty = computed(() => {
  if (!searchQuery.value.trim()) return false

  const hasConnections = filteredLinkedIntegrations.value.length > 0
  const hasIntegrations = Object.values(integrationsMap.value).some((cat) => cat.list.length > 0)

  return !hasConnections && !hasIntegrations
})

onMounted(async () => {
  isFromIntegrationPage.value = true

  if (!basesUser.value.has(baseId.value)) {
    basesStore.getBaseUsers({ baseId: baseId.value }).catch(() => {})
  }

  await Promise.all([reload(), loadDynamicIntegrations(), ...(isEeUI ? [loadEnvironments()] : [])])
})

watch(viewMode, () => {
  searchQuery.value = ''
  connectionsSearchQuery.value = ''
})

watch(mainSearchInputRef, (el) => {
  if (el) {
    forcedNextTick(() => {
      mainSearchInputRef.value?.focus()
    })
  }
})

watch(connectionsSearchInputRef, (el) => {
  if (el) {
    forcedNextTick(() => {
      connectionsSearchInputRef.value?.focus()
    })
  }
})

onBeforeUnmount(() => {
  isFromIntegrationPage.value = false
})

watch(baseId, reload)
</script>

<template>
  <div class="flex w-full flex-col h-full nc-base-integrations">
    <!-- Main page: active connections + integration categories -->
    <template v-if="viewMode === 'main'">
      <div class="h-full w-full overflow-y-auto nc-scrollbar-thin">
        <div class="px-8 pt-6 pb-8 flex flex-col nc-workspace-settings-integrations-list">
          <div class="text-sm font-normal text-nc-content-gray-subtle2 mb-4">
            {{ $t('msg.manageBaseIntegrations') }}
          </div>

          <a-input
            ref="mainSearchInputRef"
            v-model:value="searchQuery"
            type="text"
            class="nc-input-border-on-value nc-search-integration-input !rounded-lg !py-2 !h-9 mb-4"
            :placeholder="$t('placeholder.searchConnectionsOrIntegrations')"
            allow-clear
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
            </template>
          </a-input>

          <div class="flex flex-col space-y-6 w-full">
            <!-- Full-page skeleton during initial load -->
            <WorkspaceIntegrationsSkeleton v-if="!isLoaded" :connection-count="3" />

            <!-- Real content (shown after first load) -->
            <template v-else>
              <!-- Active connections section (if any) -->
              <div v-if="filteredLinkedIntegrations.length" style="container-type: inline-size">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-weight-700 text-nc-content-gray mb-0">
                      {{ $t('general.activeConnections') }}
                    </h3>
                    <NcBadge
                      :border="false"
                      class="bg-nc-bg-brand-inverted text-nc-content-gray-subtle2 text-xs min-w-5 !h-5 flex justify-center"
                    >
                      {{ filteredLinkedIntegrations.length }}
                    </NcBadge>
                  </div>

                  <NcButton
                    type="link"
                    size="small"
                    class="!text-nc-content-brand !px-0 !h-auto !min-h-0"
                    inner-class="hover:underline"
                    @click="viewMode = 'all-connections'"
                  >
                    {{ $t('general.viewAllConnections') }}
                    <GeneralIcon icon="arrowRight" class="ml-1" />
                  </NcButton>
                </div>

                <div class="nc-connection-cards-grid grid grid-cols-1 gap-3">
                  <WorkspaceIntegrationsConnectionCard
                    v-for="connection in visibleLinkedConnections"
                    :key="connection.id"
                    :integration="connection"
                    :collaborators-map="collaboratorsMap"
                    mode="base"
                    :can-edit="canEditIntegration(connection)"
                    :can-unlink="canUnlinkIntegration(connection)"
                    :base-id="baseId"
                    @edit="handleEdit"
                    @unlink="handleUnlink"
                  />

                  <div v-if="overflowCount > 0" class="nc-connection-overflow-card" @click="viewMode = 'all-connections'">
                    <div class="text-sm font-semibold text-nc-content-gray">+{{ overflowCount }} {{ $t('general.more') }}</div>
                    <div class="text-xs text-nc-content-gray-subtle2">
                      {{ $t('general.viewAllConnections') }}
                    </div>
                  </div>
                </div>
              </div>

              <NcDivider v-if="filteredLinkedIntegrations.length" />

              <!-- Integration categories -->
              <template v-for="(category, key) in integrationsMap" :key="key">
                <div v-if="category.list.length" class="integration-type-wrapper" style="container-type: inline-size">
                  <div class="category-type-title">{{ $t(category.title) }}</div>
                  <div class="integration-type-list grid grid-cols-1 gap-3">
                    <template v-for="integration of category.list" :key="integration.sub_type">
                      <div class="source-card is-available" tabindex="0" @click="handleAddIntegration(integration)">
                        <div class="integration-icon-wrapper">
                          <component :is="integration.icon" class="integration-icon" :style="integration.iconStyle" />
                        </div>
                        <div class="flex-1">
                          <div class="name">{{ $t(integration.title) }}</div>
                          <div v-if="integration.subtitle" class="subtitle">{{ $t(integration.subtitle) }}</div>
                        </div>
                        <NcButton type="secondary" size="xs" class="action-btn !rounded-lg !px-1 !py-0">
                          <div class="flex items-center gap-2">
                            <GeneralIcon icon="ncPlus" class="flex-none" />
                          </div>
                        </NcButton>
                      </div>
                    </template>
                  </div>
                </div>
              </template>

              <!-- Empty search state -->
              <div v-if="isSearchEmpty" class="flex-1 flex items-center justify-center py-12">
                <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- All connections page -->
    <template v-else-if="viewMode === 'all-connections'">
      <div class="h-full flex flex-col px-8 py-6">
        <NcButton
          v-if="canManage"
          type="link"
          size="small"
          class="!text-nc-content-brand self-start !-ml-1.5 mb-4 !p-0 !h-auto !min-h-0"
          inner-class="hover:underline"
          @click="viewMode = 'main'"
        >
          <GeneralIcon icon="arrowLeft" class="mr-1" />
          {{ $t('general.backToIntegrations') }}
        </NcButton>

        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold text-nc-content-gray mb-0">
            {{ $t('general.allConnections') }}
          </h2>
          <WorkspaceIntegrationsAddConnectionDropdown v-if="canManage" mode="base" />
        </div>
        <div class="text-sm font-normal text-nc-content-gray-subtle2 mb-4">
          {{ $t('msg.manageAllConnections') }}
        </div>

        <a-input
          ref="connectionsSearchInputRef"
          v-model:value="connectionsSearchQuery"
          type="text"
          class="nc-input-border-on-value nc-search-integration-input !rounded-lg !py-2 !h-9 mb-4"
          :placeholder="`${$t('general.search')} ${$t('general.connections').toLowerCase()}...`"
          allow-clear
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
          </template>
        </a-input>

        <div class="flex-1 min-h-0">
          <div class="h-full flex flex-col gap-6 nc-content-max-w mx-auto">
            <NcTable
              v-model:order-by="orderBy"
              :columns="linkedColumns"
              :data="filteredAllConnections"
              :is-data-loading="isLoading"
              :custom-row="customRow"
              sticky-first-column
              class="h-full"
            >
              <template #bodyCell="{ column, record: integration }">
                <div v-if="column.key === 'title'" class="w-full flex items-center gap-3">
                  <NcTooltip placement="bottom" class="truncate !text-nc-content-gray font-semibold" show-on-truncate-only>
                    <template #title>{{ integration.title }}</template>
                    {{ integration.title }}
                  </NcTooltip>
                  <NcBadge v-if="integration.is_private" :border="false" class="text-primary !h-4.5 bg-nc-bg-brand text-xs">
                    {{ $t('general.private') }}
                  </NcBadge>
                  <span v-if="isPerUserIntegration(integration)">
                    <NcTooltip placement="bottom" :title="$t('msg.info.perUserIntegration')">
                      <NcBadge :border="false" class="!h-4.5 text-xs bg-nc-bg-purple-light text-nc-content-purple-dark">
                        {{ $t('general.perUser') }}
                      </NcBadge>
                    </NcTooltip>
                  </span>
                </div>

                <div v-if="column.key === 'environments'" class="flex items-center gap-1.5">
                  <!-- Only Auth & AI integrations support per-environment overrides -->
                  <span v-if="!integrationSupportsEnvironments(integration.type)" class="text-nc-content-gray-muted">–</span>
                  <NcTooltip v-for="env in environments" v-else :key="env.key" placement="bottom">
                    <template #title>
                      {{ env.title }} —
                      <template v-if="isEnvironmentBlocked(env)">{{ $t('msg.info.environmentLocked') }}</template>
                      <template v-else-if="isPerUserIntegration(integration)">
                        {{ isEnvConfigured(integration, env) ? $t('general.connected') : $t('general.notConnected') }}
                      </template>
                      <template v-else>
                        {{ isEnvConfigured(integration, env) ? $t('general.configured') : $t('msg.info.fallsBackToProduction') }}
                      </template>
                    </template>
                    <span v-if="isEnvironmentBlocked(env)">
                      <PaymentUpgradeBadge :feature="environmentUpgradeFeature(env)" remove-click />
                    </span>
                    <span
                      v-else
                      class="w-2.5 h-2.5 rounded-full border-2 flex-none inline-block"
                      :style="
                        isEnvConfigured(integration, env)
                          ? { backgroundColor: env.color, borderColor: env.color }
                          : { backgroundColor: 'transparent', borderColor: 'var(--nc-border-gray-medium)' }
                      "
                    />
                  </NcTooltip>
                </div>

                <NcTooltip
                  v-if="column.key === 'sub_type'"
                  placement="bottom"
                  class="h-8 w-8 flex-none flex items-center justify-center children:flex-none"
                >
                  <template #title>{{ integration?.sub_type }}</template>
                  <GeneralIntegrationIcon :type="integration.sub_type" size="lg" />
                </NcTooltip>

                <NcTooltip v-if="column.key === 'created_at'" placement="bottom" show-on-truncate-only>
                  <template #title>{{ dayjs(integration.created_at).local().format('DD MMM YYYY') }}</template>
                  {{ dayjs(integration.created_at).local().format('DD MMM YYYY') }}
                </NcTooltip>

                <template v-if="column.key === 'created_by'">
                  <div
                    v-if="integration.created_by && collaboratorsMap.get(integration.created_by)"
                    class="w-full flex gap-3 items-center"
                  >
                    <GeneralUserIcon :user="collaboratorsMap.get(integration.created_by)" size="base" class="flex-none" />
                    <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                      <NcTooltip
                        class="text-sm !leading-5 capitalize font-semibold truncate text-nc-content-gray"
                        show-on-truncate-only
                        placement="bottom"
                      >
                        <template #title>{{ getUserName(integration.created_by) }}</template>
                        {{ getUserName(integration.created_by) }}
                      </NcTooltip>
                      <NcTooltip
                        class="text-xs !leading-4 text-nc-content-gray-muted truncate"
                        show-on-truncate-only
                        placement="bottom"
                      >
                        <template #title>{{ collaboratorsMap.get(integration.created_by)?.email }}</template>
                        {{ collaboratorsMap.get(integration.created_by)?.email }}
                      </NcTooltip>
                    </div>
                  </div>
                  <div v-else class="w-full truncate text-nc-content-gray-muted">{{ integration.created_by }}</div>
                </template>

                <template v-if="column.key === 'source_count'">
                  {{ integration.source_count ?? 0 }}
                </template>

                <div v-if="column.key === 'base_access'" class="flex items-center gap-2">
                  <NcBadge v-if="integration.is_global" size="xs" color="blue" :border="false">
                    {{ $t('general.global') }}
                  </NcBadge>
                  <NcBadge v-else-if="integration.is_restricted" size="xs" color="gray" :border="false">
                    {{ $t('labels.restricted') }}
                  </NcBadge>
                  <NcBadge v-else size="xs" color="green" :border="false">
                    {{ $t('activity.allBases') }}
                  </NcBadge>
                </div>

                <div v-if="column.key === 'action'" @click.stop>
                  <WorkspaceIntegrationsConnectionActionMenu
                    v-if="hasAnyAction(integration)"
                    :integration="integration"
                    mode="base"
                    :can-edit="canEditIntegration(integration)"
                    :can-unlink="canUnlinkIntegration(integration)"
                    :base-id="baseId"
                    @unlink="handleUnlink"
                  />
                </div>
              </template>

              <template #emptyText>
                <div class="flex flex-col items-center gap-3 py-12 text-nc-content-gray-subtle2">
                  <GeneralIcon icon="ncIntegrationDuo" class="h-10 w-10 opacity-50" />
                  <span class="text-sm">{{ $t('msg.noIntegrationsLinked') }}</span>
                </div>
              </template>
            </NcTable>
          </div>
        </div>
      </div>
    </template>

    <!-- Integration config form modal -->
    <WorkspaceIntegrationsEditOrAdd :base-id="baseId" />
  </div>
</template>

<style lang="scss" scoped>
.nc-connection-cards-grid {
  @supports not (container-type: inline-size) {
    @media (min-width: 540px) {
      @apply grid-cols-2;
    }

    @media (min-width: 820px) {
      @apply grid-cols-3;
    }

    @media (min-width: 1140px) {
      @apply grid-cols-4;
    }
  }

  @container (min-width: 540px) {
    @apply grid-cols-2;
  }

  @container (min-width: 820px) {
    @apply grid-cols-3;
  }

  @container (min-width: 1140px) {
    @apply grid-cols-4;
  }
}

.nc-connection-overflow-card {
  @apply flex flex-col items-center justify-center gap-1 border-1 border-dashed border-nc-border-gray-medium rounded-xl p-3 cursor-pointer transition-all duration-200;

  &:hover {
    @apply bg-nc-bg-gray-extralight border-nc-border-gray-dark;
  }
}

// Card grid styles — same as workspace IntegrationsTab
.nc-workspace-settings-integrations-list {
  .integration-type-wrapper {
    @apply flex flex-col gap-3;

    .integration-type-list {
      @supports not (container-type: inline-size) {
        @media (min-width: 540px) {
          @apply grid-cols-2;
        }

        @media (min-width: 1024px) {
          @apply grid-cols-3;
        }

        @media (min-width: 1440px) {
          @apply grid-cols-4;
        }
      }

      @container (min-width: 540px) {
        @apply grid-cols-2;
      }

      @container (min-width: 820px) {
        @apply grid-cols-3;
      }

      @container (min-width: 1140px) {
        @apply grid-cols-4;
      }

      .source-card {
        @apply flex items-center gap-4 border-1 border-nc-border-gray-medium rounded-xl p-3 cursor-pointer transition-all duration-300;

        .integration-icon-wrapper {
          @apply flex-none h-[44px] w-[44px] rounded-lg flex items-center justify-center;

          .integration-icon {
            @apply flex-none stroke-transparent;
          }
        }

        .name {
          @apply text-base font-bold;
        }

        .subtitle {
          @apply text-xs text-nc-content-gray-muted;
        }

        .action-btn {
          @apply hidden;
        }

        &.is-available {
          &:hover {
            @apply bg-nc-bg-gray-extralight;
            box-shadow: 0px 4px 8px -2px rgba(var(--rgb-base), 0.08), 0px 2px 4px -2px rgba(var(--rgb-base), 0.04);

            .action-btn {
              @apply inline-block;
            }
          }

          .name {
            @apply text-nc-content-gray;
          }
        }
      }
    }

    .category-type-title {
      @apply text-sm text-nc-content-gray-subtle font-weight-700;
    }
  }
}
</style>
