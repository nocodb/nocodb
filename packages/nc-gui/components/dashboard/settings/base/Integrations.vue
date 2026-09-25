<script setup lang="ts">
import dayjs from 'dayjs'
import { DefaultEnvironmentKey, IntegrationCategoryType, IntegrationsType, integrationSupportsEnvironments } from 'nocodb-sdk'
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
  requestIntegration,
} = useIntegrationStore()

const { isEEFeatureBlocked, isEnvironmentBlocked, environmentUpgradeFeature, showEEFeatures } = useEeConfig()

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

const shell = useShell()

// Escape leaves the connections list before it closes the shell.
const onShellBack = () => {
  if (viewMode.value === 'main') return false

  viewMode.value = 'main'

  return true
}

onMounted(() => shell?.registerBackHandler(onShellBack))

onBeforeUnmount(() => shell?.unregisterBackHandler(onShellBack))

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

// Integrations that have their own management surface are excluded from the
// connection lists: syncs live in Manage Syncs, channels in an agent's Channels
// settings. Listing them here would offer a second, weaker place to edit them.
const nonSyncLinkedIntegrations = computed(() =>
  linkedIntegrations.value.filter((i) => i.type !== IntegrationsType.Sync && i.type !== IntegrationsType.Channel),
)

const filteredAllConnections = computed(() => {
  if (!connectionsSearchQuery.value.trim()) return nonSyncLinkedIntegrations.value

  const query = connectionsSearchQuery.value.trim().toLowerCase()
  return nonSyncLinkedIntegrations.value.filter((i) => i.title?.toLowerCase().includes(query))
})

// Filtered linked integrations based on search
const filteredLinkedIntegrations = computed(() => {
  if (!searchQuery.value.trim()) return nonSyncLinkedIntegrations.value

  const query = searchQuery.value.trim().toLowerCase()
  return nonSyncLinkedIntegrations.value.filter((i) => i.title?.toLowerCase().includes(query))
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
          // EE-only (e.g. MSSQL, Oracle) hidden in CE and in community mode; in a
          // normal EE build gated by their paid add-on.
          (showEEFeatures.value || !i.isEeOnly) &&
          i.sub_type !== SyncDataType.NOCODB &&
          (!query || integrationLabel(i.title).toLowerCase().includes(query)),
      ),
    }
  }
  return map
})

/**
 * Browse gallery state. Categories become filter pills over one flat grid rather
 * than a stack of per-category sections: the whole catalogue is ~30 items, so a
 * single scannable grid beats several short ones, and the pills make "show me
 * only AI" one click instead of a scroll.
 */
const activeCategory = ref<string>('all')

/**
 * Apps is the SaaS side of the catalogue. The underlying AUTH category carries
 * every provider that *can* authenticate, datastores and raw protocols included,
 * so it needs pruning to mean anything.
 *
 * A deny-list rather than a dedupe against the other pills: Database identifies
 * the same products by driver id (`pg`, `mysql2`) where AUTH uses product names
 * (`postgres`, `mysql`), so matching on sub_type would never catch them -- and
 * Redis, ClickHouse and http-api are not under any other pill yet still are not
 * apps.
 */
const appsCategory = IntegrationCategoryType.AUTH

const NON_APP_SUB_TYPES = new Set([
  // datastores
  'postgres',
  'pg',
  'mysql',
  'mysql2',
  'mssql',
  'oracledb',
  'sqlite3',
  'clickhouse',
  'snowflake',
  'databricks',
  'redis',
  // raw protocols, not products
  'http-api',
  'smtp',
  'caldav',
])

const isAppIntegration = (i: IntegrationItemType) => !NON_APP_SUB_TYPES.has(String(i.sub_type))

const categoryPills = computed(() => [
  { value: 'all', title: 'general.all' },
  ...Object.values(integrationsMap.value)
    .filter((c) => (c.value === appsCategory ? c.list.some(isAppIntegration) : c.list.length))
    .map((c) => ({ value: c.value, title: c.title })),
])

/** Flat, so "All" is one grid. */
const browseItems = computed(() =>
  Object.values(integrationsMap.value)
    .filter((c) => activeCategory.value === 'all' || c.value === activeCategory.value)
    .flatMap((c) =>
      (c.value === appsCategory ? c.list.filter(isAppIntegration) : c.list).map((i) => ({
        integration: i,
      })),
    ),
)

// A pill that no longer matches anything (the search narrowed it away) would
// leave an empty grid with no way back, so fall to All.
watch(browseItems, (items) => {
  if (!items.length && activeCategory.value !== 'all') activeCategory.value = 'all'
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
  return extractUserDisplayNameOrEmail(user) || userId
}

// The line under the name, standing in for the Date added column.
const integrationSubtext = (integration: IntegrationType) =>
  t('labels.addedOnDate', { date: dayjs(integration.created_at).local().format('DD MMM YYYY') })

const linkedColumns = computed<NcTableColumnProps[]>(
  () =>
    [
      // Carries the type icon, and the date added beneath the name.
      {
        key: 'title',
        title: t('general.name'),
        minWidth: 250,
        dataIndex: 'title',
        showOrderBy: true,
        padding: '0px 24px',
      },
      // Environments column — same semantics as the workspace connections list.
      ...(isEeUI
        ? [
            {
              key: 'environments',
              title: t('title.environments'),
              minWidth: 100,
              width: 110,
              padding: '0px 24px',
            },
          ]
        : []),
      {
        key: 'created_by',
        title: t('labels.addedBy'),
        minWidth: 180,
        basis: '20%',
        dataIndex: 'created_by',
        showOrderBy: true,
        padding: '0px 24px',
      },
      {
        key: 'source_count',
        title: t('general.usage'),
        minWidth: 100,
        width: 110,
        dataIndex: 'source_count',
        showOrderBy: true,
        padding: '0px 24px',
      },
      // Base access + row actions are manager-only surfaces.
      ...(canManage.value
        ? [
            {
              key: 'base_access',
              title: t('labels.baseAccess'),
              minWidth: 110,
              width: 120,
              padding: '0px 24px',
            },
            {
              key: 'action',
              title: '',
              minWidth: 72,
              width: 72,
              justify: 'justify-end',
              padding: '0px 24px',
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

/**
 * "Added <date> by <name>", skipping whichever half is unknown. Deliberately not
 * "Used in N projects": this pane has no project-usage count for a connection,
 * and a fabricated number on a permissions-adjacent row is worse than no number.
 */
function connectionMeta(connection: IntegrationType) {
  const parts: string[] = []

  if (connection.created_at) {
    parts.push(t('labels.addedOnDate', { date: dayjs(connection.created_at).local().format('DD MMM YYYY') }))
  }

  const by = collaboratorsMap.value?.get(connection.created_by as string)
  const name = (by as any)?.display_name || (by as any)?.email

  if (name) parts.push(t('labels.byUser', { user: name }))

  return parts.join(' · ')
}

/** The list collapses past this; the rest arrive via the expander. */
const maxVisibleRows = 4

const isConnectionsExpanded = ref(false)

const visibleConnectionRows = computed(() =>
  isConnectionsExpanded.value ? filteredLinkedIntegrations.value : filteredLinkedIntegrations.value.slice(0, maxVisibleRows),
)

const hiddenConnectionCount = computed(() => Math.max(0, filteredLinkedIntegrations.value.length - maxVisibleRows))

const browseSectionRef = ref<HTMLElement | null>(null)

const isBrowseHighlighted = ref(false)

/**
 * "Add connection" has nowhere of its own to go -- adding one means picking from
 * the gallery below -- so it takes you there and leaves the cursor in search.
 *
 * Focus is deferred until the scroll has settled: focusing first makes the
 * browser jump the caret into view and the smooth scroll never plays.
 */
function scrollToBrowse() {
  const section = browseSectionRef.value

  if (!section) return

  // Deferred a frame: called synchronously inside the click, the scroll is
  // dropped -- the highlight class lands in the same tick and the element is
  // still being laid out when the request is made.
  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  isBrowseHighlighted.value = true

  setTimeout(() => (isBrowseHighlighted.value = false), 1400)

  setTimeout(() => {
    const input = (mainSearchInputRef.value as any)?.input ?? (mainSearchInputRef.value as any)

    input?.focus?.()
  }, 450)
}

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
      <div class="flex flex-col h-full nc-shell-gutter pb-6 pt-3 nc-workspace-settings-integrations-list">
        <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
          <div class="flex flex-col space-y-6 w-full">
            <!-- Full-page skeleton during initial load -->
            <WorkspaceIntegrationsSkeleton v-if="!isLoaded" :connection-count="3" />

            <!-- Real content (shown after first load) -->
            <template v-else>
              <!-- Your connections: a list, not cards. These are records to scan and
                   act on, so one row each beats a grid of tiles. -->
              <div v-if="filteredLinkedIntegrations.length" class="nc-connections-block">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <h3 class="text-bodyDefault font-semibold text-nc-content-gray-emphasis mb-0">
                      {{ $t('labels.yourConnections') }}
                    </h3>
                    <NcBadge size="xs" color="gray" :border="false">
                      {{ filteredLinkedIntegrations.length }}
                    </NcBadge>
                  </div>

                  <div class="flex items-center gap-2">
                    <NcButton
                      type="text"
                      size="small"
                      class="nc-manage-link !text-nc-content-brand"
                      @click="viewMode = 'all-connections'"
                    >
                      {{ $t('general.manage') }}
                      <GeneralIcon icon="arrowRight" class="ml-1" />
                    </NcButton>

                    <NcButton type="primary" size="small" data-testid="nc-add-connection" @click="scrollToBrowse">
                      <div class="flex items-center gap-1.5">
                        <GeneralIcon icon="plus" class="w-4 h-4" />
                        {{ $t('labels.addConnection') }}
                      </div>
                    </NcButton>
                  </div>
                </div>

                <div class="nc-connection-list">
                  <div
                    v-for="connection in visibleConnectionRows"
                    :key="connection.id"
                    class="nc-connection-row"
                    :data-testid="`nc-connection-row-${connection.id}`"
                    @click="canEditIntegration(connection) && handleEdit(connection)"
                  >
                    <span class="nc-connection-row-icon">
                      <GeneralIntegrationIcon :type="connection.sub_type" />
                    </span>

                    <div class="flex-1 min-w-0 flex flex-col">
                      <NcTooltip class="text-bodyDefaultSm font-semibold text-nc-content-gray truncate" show-on-truncate-only>
                        {{ connection.title }}
                      </NcTooltip>
                      <span class="text-bodySm text-nc-content-gray-muted truncate">
                        {{ connectionMeta(connection) }}
                      </span>
                    </div>

                    <div v-if="canEditIntegration(connection) || canUnlinkIntegration(connection)" class="flex-none" @click.stop>
                      <WorkspaceIntegrationsConnectionActionMenu
                        :integration="connection"
                        mode="base"
                        :can-edit="canEditIntegration(connection)"
                        :can-unlink="canUnlinkIntegration(connection)"
                        :base-id="baseId"
                        @unlink="handleUnlink"
                      >
                        <NcButton size="xs" type="text" class="!px-1" @click.stop>
                          <GeneralIcon icon="threeDotVertical" />
                        </NcButton>
                      </WorkspaceIntegrationsConnectionActionMenu>
                    </div>
                  </div>

                  <button
                    v-if="hiddenConnectionCount > 0 || isConnectionsExpanded"
                    type="button"
                    class="nc-connection-expander"
                    data-testid="nc-connections-expander"
                    @click="isConnectionsExpanded = !isConnectionsExpanded"
                  >
                    <GeneralIcon
                      icon="chevronDown"
                      class="w-4 h-4 transition-transform duration-200"
                      :class="{ 'rotate-180': isConnectionsExpanded }"
                    />
                    {{
                      isConnectionsExpanded
                        ? $t('general.showLess')
                        : $t('labels.showMoreConnections', { count: hiddenConnectionCount })
                    }}
                  </button>
                </div>
              </div>

              <NcDivider v-if="filteredLinkedIntegrations.length" />

              <!-- Browse gallery: one grid, categories as filter pills -->
              <div
                ref="browseSectionRef"
                class="nc-browse-integrations"
                :class="{ 'nc-browse-highlight': isBrowseHighlighted }"
                style="container-type: inline-size"
              >
                <!-- Filter and search share a line: both narrow the same grid, so
                     they belong together rather than a screen apart. -->
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div v-if="categoryPills.length > 2" class="flex flex-wrap items-center gap-2">
                    <button
                      v-for="pill of categoryPills"
                      :key="pill.value"
                      type="button"
                      class="nc-browse-pill"
                      :class="{ active: activeCategory === pill.value }"
                      :data-testid="`nc-browse-pill-${pill.value}`"
                      @click="activeCategory = pill.value"
                    >
                      {{ $t(pill.title) }}
                    </button>
                  </div>
                  <span v-else />

                  <a-input
                    ref="mainSearchInputRef"
                    v-model:value="searchQuery"
                    type="text"
                    class="nc-input-border-on-value !w-64 nc-input-sm"
                    :placeholder="$t('labels.searchIntegrations')"
                    allow-clear
                    data-testid="nc-browse-integrations-search"
                  >
                    <template #prefix>
                      <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
                    </template>
                  </a-input>
                </div>

                <div class="nc-browse-grid">
                  <button
                    v-for="item of browseItems"
                    :key="`${item.integration.type}-${item.integration.sub_type}`"
                    type="button"
                    class="nc-browse-card"
                    :data-testid="`nc-browse-card-${item.integration.sub_type}`"
                    @click="handleAddIntegration(item.integration)"
                  >
                    <span class="nc-browse-logo">
                      <!-- `iconStyle` hard-codes 32px on some logos, which inline-styles
                           over any class and bursts the tile; the tile sizes them instead. -->
                      <component :is="item.integration.icon" />
                    </span>

                    <NcTooltip
                      class="flex-1 min-w-0 text-left text-bodyDefaultSm font-semibold text-nc-content-gray truncate"
                      show-on-truncate-only
                    >
                      {{ integrationLabel(item.integration.title) }}
                    </NcTooltip>
                  </button>

                  <!-- Always last, and dotted: it is an ask rather than a thing you
                       can connect, so it reads as an outline of a card, not a card. -->
                  <button
                    type="button"
                    class="nc-browse-card nc-browse-card-request"
                    data-testid="nc-browse-card-request"
                    @click="requestIntegration.isOpen = true"
                  >
                    <span class="nc-browse-logo nc-browse-logo-request">
                      <GeneralIcon icon="ncPlus" class="w-4.5 h-4.5" />
                    </span>

                    <span class="flex-1 min-w-0 text-left text-bodyDefaultSm font-semibold text-nc-content-gray truncate">
                      {{ $t('labels.requestIntegration') }}
                    </span>
                  </button>
                </div>
              </div>

              <WorkspaceIntegrationsRequestDialog />

              <ShellEmpty v-if="isSearchEmpty" :title="$t('title.noResultsMatchedYourSearch')" />
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- All connections page -->
    <template v-else-if="viewMode === 'all-connections'">
      <div class="flex flex-col h-full nc-shell-gutter pb-6 pt-3">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <!-- Back on the left, search on the right: the row reads as navigation
               then filter, rather than two controls crowding the same corner. -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <!-- Hidden for non-managers: they land here directly, with no catalogue to go back to. -->
            <ShellDrillBack
              v-if="canManage"
              :label="$t('general.integrations')"
              testid="nc-integrations-connections-back"
              @back="viewMode = 'main'"
            />
            <span v-else />

            <a-input
              ref="connectionsSearchInputRef"
              v-model:value="connectionsSearchQuery"
              type="text"
              class="nc-search-integration-input nc-input-border-on-value !w-64 nc-input-sm"
              :placeholder="$t('placeholder.searchConnections')"
              allow-clear
            >
              <template #prefix>
                <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
              </template>
            </a-input>
          </div>

          <ShellActions>
            <WorkspaceIntegrationsAddConnectionDropdown v-if="canManage" mode="base">
              <NcButton v-e="['c:integration:add-connection']" type="primary" size="small" data-testid="nc-add-connection-btn">
                <div class="flex items-center gap-1">
                  <GeneralIcon icon="plus" />
                  <span>{{ $t('labels.addConnection') }}</span>
                </div>
              </NcButton>
            </WorkspaceIntegrationsAddConnectionDropdown>
          </ShellActions>
        </div>

        <div class="flex-1 min-h-0 flex flex-col">
          <NcTable
            v-model:order-by="orderBy"
            hide-on-empty
            :columns="linkedColumns"
            :data="filteredAllConnections"
            :is-data-loading="isLoading"
            :custom-row="customRow"
            sticky-first-column
            row-height="54px"
            header-row-height="54px"
            class="max-h-full min-h-0 w-full"
          >
            <template #bodyCell="{ column, record: integration }">
              <div v-if="column.key === 'title'" class="w-full flex items-center gap-3">
                <!-- The type rides on the name rather than holding a column of its own. -->
                <NcTooltip
                  placement="bottom"
                  class="h-8 w-8 flex-none flex items-center justify-center rounded-md bg-nc-bg-gray-light children:flex-none"
                >
                  <template #title>{{ integration?.sub_type }}</template>
                  <GeneralIntegrationIcon :type="integration.sub_type" />
                </NcTooltip>

                <div class="flex-1 min-w-0 flex flex-col">
                  <div class="flex items-center gap-2">
                    <NcTooltip placement="bottom" class="truncate text-captionMedium text-nc-content-gray" show-on-truncate-only>
                      <template #title>{{ integration.title }}</template>
                      {{ integration.title }}
                    </NcTooltip>
                    <NcBadge v-if="integration.is_private" size="xs" color="brand" :border="false">
                      {{ $t('general.private') }}
                    </NcBadge>
                    <span v-if="isPerUserIntegration(integration)">
                      <NcTooltip placement="bottom" :title="$t('msg.info.perUserIntegration')">
                        <NcBadge size="xs" color="purple" :border="false">
                          {{ $t('general.perUser') }}
                        </NcBadge>
                      </NcTooltip>
                    </span>
                  </div>

                  <NcTooltip class="truncate text-bodySm text-nc-content-gray-muted" show-on-truncate-only placement="bottom">
                    <template #title>{{ integrationSubtext(integration) }}</template>
                    {{ integrationSubtext(integration) }}
                  </NcTooltip>
                </div>
              </div>

              <div v-if="column.key === 'environments'" class="flex items-center gap-1.5">
                <!-- Only Auth & AI integrations support per-environment overrides -->
                <span v-if="!integrationSupportsEnvironments(integration.type)" class="text-nc-content-gray-muted">–</span>
                <NcTooltip v-for="env in environments" v-else :key="env.key" placement="bottom">
                  <template #title>
                    {{ env.title }}:
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

              <template v-if="column.key === 'created_by'">
                <div
                  v-if="integration.created_by && collaboratorsMap.get(integration.created_by)"
                  class="w-full flex gap-3 items-center"
                >
                  <GeneralUserIcon :user="collaboratorsMap.get(integration.created_by)" size="base" class="flex-none" />
                  <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                    <NcTooltip
                      class="text-bodyDefaultSm capitalize font-semibold truncate text-nc-content-gray"
                      show-on-truncate-only
                      placement="bottom"
                    >
                      <template #title>{{ getUserName(integration.created_by) }}</template>
                      {{ getUserName(integration.created_by) }}
                    </NcTooltip>
                    <NcTooltip class="text-bodySm text-nc-content-gray-muted truncate" show-on-truncate-only placement="bottom">
                      <template #title>{{ collaboratorsMap.get(integration.created_by)?.email }}</template>
                      {{ collaboratorsMap.get(integration.created_by)?.email }}
                    </NcTooltip>
                  </div>
                </div>
                <div v-else class="w-full truncate text-nc-content-gray-muted">{{ integration.created_by }}</div>
              </template>

              <span v-if="column.key === 'source_count'" class="text-bodyDefaultSm text-nc-content-gray-subtle2">
                {{ integration.source_count ?? 0 }}
              </span>

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

              <div v-if="column.key === 'action'" class="nc-row-action" @click.stop>
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
              <ShellEmpty
                :title="
                  nonSyncLinkedIntegrations.length === 0 ? $t('msg.noIntegrationsLinked') : $t('title.noResultsMatchedYourSearch')
                "
              />
            </template>
          </NcTable>
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
  @apply flex flex-col items-center justify-center gap-1 border-1 border-dashed border-nc-border-gray-medium rounded-lg p-3 cursor-pointer transition-all duration-200;

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

      .source-card {
        @apply flex items-center gap-4 border-1 border-nc-border-gray-medium rounded-lg p-3 cursor-pointer transition-all duration-300;

        .integration-icon-wrapper {
          @apply flex-none h-[44px] w-[44px] rounded-lg flex items-center justify-center;

          .integration-icon {
            @apply flex-none stroke-transparent;
          }
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
        }
      }
    }
  }
}

/* ---------- Your connections ---------- */

// `font-normal` resolves to 500 in this theme, so a real 400 is written out.
.nc-manage-link {
  font-weight: 400 !important;
}

.nc-connections-block {
  @apply flex flex-col gap-4;
}

.nc-connection-list {
  @apply flex flex-col rounded-xl border-1 border-nc-border-gray-medium overflow-hidden;
}

.nc-connection-row {
  @apply flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150
    border-b-1 border-nc-border-gray-light;

  &:last-child {
    @apply border-b-0;
  }

  &:hover {
    @apply bg-nc-bg-gray-extralight;
  }
}

.nc-connection-row-icon {
  @apply flex-none flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden bg-nc-bg-gray-extralight;

  :deep(svg),
  :deep(img) {
    width: 18px !important;
    height: 18px !important;
    object-fit: contain;
  }
}

.nc-connection-expander {
  @apply flex items-center justify-center gap-1.5 w-full py-2.5 cursor-pointer bg-transparent
    border-0 border-t-1 border-nc-border-gray-light text-bodySm text-nc-content-gray-subtle2;

  &:hover {
    @apply bg-nc-bg-gray-extralight text-nc-content-gray;
  }
}

/* A flash, not a persistent state: it says "the thing you asked for is here". */
.nc-browse-highlight {
  animation: nc-browse-flash 1.4s ease-out;
}

@keyframes nc-browse-flash {
  0%,
  100% {
    background-color: transparent;
  }
  20% {
    background-color: var(--nc-bg-brand);
  }
}

/* ---------- Browse integrations gallery ---------- */

.nc-browse-integrations {
  @apply flex flex-col gap-4;
}

.nc-browse-pill {
  @apply px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150
    text-bodySm border-1 border-nc-border-gray-medium bg-transparent text-nc-content-gray-subtle2;

  &:hover:not(.active) {
    @apply bg-nc-bg-gray-extralight text-nc-content-gray;
  }

  /* Filled rather than tinted: one pill is on at a time, so the selected state
     has to read at a glance across a row of otherwise identical chips. */
  &.active {
    @apply border-transparent bg-nc-fill-primary text-white;
  }
}

/* Container queries, not viewport: this pane sits in a modal whose width is set
   by the shell, so the breakpoint that matters is the pane's, not the screen's. */
.nc-browse-grid {
  @apply grid gap-3;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

@container (min-width: 520px) {
  .nc-browse-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (min-width: 780px) {
  .nc-browse-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (min-width: 1100px) {
  .nc-browse-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* One line: logo, name. The category is already the pill above the grid, and a
   description on every tile turned a scannable list into a wall of prose. */
.nc-browse-card {
  @apply flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-left
    border-1 border-nc-border-gray-medium bg-nc-bg-default transition-all duration-150;

  &:hover {
    @apply border-nc-border-gray-dark;
    box-shadow: 0 2px 8px 0 rgba(var(--rgb-base), 0.06);
  }

  &:focus-visible {
    @apply outline-none border-nc-border-brand;
  }
}

/* Logos arrive in two shapes: bare glyphs, and full-bleed tiles carrying their
   own background. Normalising both to one box is what makes the grid read as a
   grid -- so the size is forced here rather than trusted from each icon. */
.nc-browse-logo {
  @apply flex-none flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden bg-nc-bg-gray-extralight;

  :deep(svg),
  :deep(img) {
    width: 18px !important;
    height: 18px !important;
    max-width: 18px !important;
    max-height: 18px !important;
    object-fit: contain;
  }
}

.nc-browse-card-request {
  @apply bg-transparent;
  border-style: dashed;

  &:hover {
    @apply bg-nc-bg-gray-extralight;
  }
}

.nc-browse-logo-request {
  @apply bg-transparent text-nc-content-gray-muted;
  border: 1px dashed var(--nc-border-gray-medium);
}
</style>
