<script setup lang="ts">
import dayjs from 'dayjs'
import { IntegrationCategoryType } from 'nocodb-sdk'
import type { IntegrationItemType, IntegrationType, NcTableColumnProps } from '#imports'

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

const { linkedIntegrations, isLoading, loadLinkedIntegrations, linkIntegration, unlinkIntegration } = useBaseIntegrations()

const canManage = computed(() => isUIAllowed('baseIntegrationCreate'))

// Integration store (provided by View.vue)
const { addIntegration, editIntegration, eventBus, isFromIntegrationPage, loadDynamicIntegrations } = useIntegrationStore()

const canEditIntegration = (integration: IntegrationType) => {
  return canManage.value && integration.created_by === user.value?.id
}

const canUnlinkIntegration = (integration: IntegrationType) => {
  return isUIAllowed('baseIntegrationUnlink') && integration.is_restricted && !integration.is_global
}

const hasAnyAction = (integration: IntegrationType) => {
  return canEditIntegration(integration) || canUnlinkIntegration(integration)
}

const activeTab = ref<'integrations' | 'connections'>('integrations')

// Build category map for the card grid
const integrationsMap = computed(() => {
  const map: Record<string, { title: string; value: string; list: IntegrationItemType[] }> = {}

  for (const cat of integrationCategories) {
    if (
      cat.value !== IntegrationCategoryType.DATABASE &&
      cat.value !== IntegrationCategoryType.AI &&
      cat.value !== IntegrationCategoryType.AUTH
    )
      continue
    if (!cat.isAvailable) continue

    map[cat.value] = {
      title: cat.title,
      value: cat.value,
      list: allIntegrations.filter(
        (i) => i.type === cat.value && i.isAvailable && !i.isOssOnly && i.sub_type !== SyncDataType.NOCODB,
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
    activeTab.value = 'connections'
    await reload()
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
        key: 'base_access',
        title: t('labels.baseAccess'),
        minWidth: 140,
        width: 160,
      },
      ...(canManage.value
        ? [
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

onMounted(async () => {
  isFromIntegrationPage.value = true

  if (!basesUser.value.has(baseId.value)) {
    basesStore.getBaseUsers({ baseId: baseId.value }).catch(() => {})
  }

  await Promise.all([reload(), loadDynamicIntegrations()])
})

onBeforeUnmount(() => {
  isFromIntegrationPage.value = false
})

watch(baseId, reload)
</script>

<template>
  <div class="flex w-full flex-col h-full nc-base-integrations">
    <!-- Custom tab bar — not using NcTabs to avoid parent's hide-tabs interference -->
    <div class="nc-base-integrations-tab-bar flex items-center border-b-1 border-nc-border-gray-medium pl-3">
      <div class="nc-base-integrations-tab" :class="{ active: activeTab === 'integrations' }" @click="activeTab = 'integrations'">
        <GeneralIcon icon="integration" />
        {{ $t('general.integrations') }}
      </div>
      <div class="nc-base-integrations-tab" :class="{ active: activeTab === 'connections' }" @click="activeTab = 'connections'">
        <GeneralIcon icon="gitCommit" />
        {{ $t('general.connections') }}
        <div
          v-if="linkedIntegrations.length"
          class="tab-count"
          :class="{
            'bg-primary-selected': activeTab === 'connections',
            'bg-nc-bg-gray-extralight': activeTab !== 'connections',
          }"
        >
          {{ linkedIntegrations.length }}
        </div>
      </div>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-hidden">
      <!-- Integrations tab — card grid -->
      <div v-show="activeTab === 'integrations'" class="h-full overflow-y-auto nc-scrollbar-thin">
        <div class="px-6 py-6 flex flex-col nc-workspace-settings-integrations-list">
          <div class="text-sm font-normal text-nc-content-gray-subtle2 mb-6">
            {{ $t('msg.manageBaseIntegrations') }}
          </div>

          <div class="flex flex-col space-y-6 w-full" style="max-width: 1168px">
            <template v-for="(category, key) in integrationsMap" :key="key">
              <div v-if="category.list.length" class="integration-type-wrapper">
                <div class="category-type-title">{{ $t(category.title) }}</div>
                <div class="integration-type-list">
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
          </div>
        </div>
      </div>

      <!-- Connections tab — linked integrations table -->
      <div v-show="activeTab === 'connections'" class="h-full p-6">
        <div class="h-full flex flex-col gap-6 nc-content-max-w mx-auto">
          <div class="text-sm font-normal text-nc-content-gray-subtle2">
            {{ $t('msg.manageBaseIntegrations') }}
          </div>
          <NcTable
            v-model:order-by="orderBy"
            :columns="linkedColumns"
            :data="linkedIntegrations"
            :is-data-loading="isLoading"
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
                <NcDropdown v-if="hasAnyAction(integration)" placement="bottomRight">
                  <NcButton size="small" type="secondary" data-testid="nc-base-integration-action-btn">
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem
                        v-if="canEditIntegration(integration)"
                        data-testid="nc-base-integration-edit-btn"
                        @click="editIntegration(integration, true, baseId)"
                      >
                        <GeneralIcon class="text-current opacity-80" icon="edit" />
                        <span>{{ $t('general.edit') }}</span>
                      </NcMenuItem>
                      <template v-if="canUnlinkIntegration(integration)">
                        <NcDivider v-if="canEditIntegration(integration)" />
                        <NcMenuItem
                          class="!text-nc-content-red-dark"
                          data-testid="nc-base-integration-unlink-btn"
                          @click="handleUnlink(integration.id)"
                        >
                          <GeneralIcon class="text-current" icon="linkRemove" />
                          <span>{{ $t('general.unlink') }}</span>
                        </NcMenuItem>
                      </template>
                    </NcMenu>
                  </template>
                </NcDropdown>
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

    <!-- Integration config form modal -->
    <WorkspaceIntegrationsEditOrAdd :base-id="baseId" />
  </div>
</template>

<style lang="scss" scoped>
// Custom tab bar — avoids parent NcTabs hide-tabs interference
.nc-base-integrations-tab-bar {
  @apply flex-none;

  .nc-base-integrations-tab {
    @apply flex items-center gap-1.5 px-3 py-2.5 text-[13px] cursor-pointer select-none;
    @apply text-nc-content-gray-subtle2 border-b-2 border-transparent;
    @apply transition-colors duration-150;

    :deep(svg) {
      @apply h-3.5 w-3.5;
    }

    &:hover {
      @apply text-nc-content-gray;
    }

    &.active {
      @apply text-nc-content-brand border-nc-content-brand font-semibold;
    }

    .tab-count {
      @apply flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs;
    }
  }
}

// Card grid styles — same as workspace IntegrationsTab
.nc-workspace-settings-integrations-list {
  .integration-type-wrapper {
    @apply flex flex-col gap-3;

    .integration-type-list {
      @apply flex gap-4 flex-wrap;

      .source-card {
        @apply flex items-center gap-4 border-1 border-nc-border-gray-medium rounded-xl p-3 w-[280px] cursor-pointer transition-all duration-300;

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
