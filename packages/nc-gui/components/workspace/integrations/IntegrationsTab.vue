<script lang="ts" setup>
import { IntegrationCategoryType, PlanFeatureTypes } from 'nocodb-sdk'
import NcModal from '~/components/nc/Modal.vue'

import { type IntegrationItemType, SyncDataType } from '#imports'

const props = withDefaults(
  defineProps<{
    isModal?: boolean
    filterCategory?: (c: IntegrationCategoryItemType) => boolean
    filterIntegration?: (i: IntegrationItemType) => boolean
    showFilter?: boolean
    showTitle?: boolean
    showActiveConnections?: boolean
  }>(),
  {
    isModal: false,
    filterCategory: () => true,
    filterIntegration: () => true,
    showFilter: false,
    showTitle: false,
    showActiveConnections: false,
  },
)

const emits = defineEmits<{
  (e: 'view-all-connections'): void
}>()

const { isModal, filterCategory, filterIntegration } = props

const { $e } = useNuxtApp()

const { t } = useI18n()

const { syncDataUpvotes, updateSyncDataUpvotes } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { activeWorkspace } = storeToRefs(useWorkspace())

const { isEEFeatureBlocked, blockAiIntegrations, showUpgradeToUseAiIntegrations, showEEFeatures } = useEeConfig()

const { isUIAllowed } = useRoles()

const easterEggToggle = computed(() => isFeatureEnabled(FEATURE_FLAG.INTEGRATIONS))

const router = useRouter()
const route = router.currentRoute

const {
  pageMode,
  IntegrationsPageMode,
  requestIntegration,
  addIntegration,
  integrationsRefreshKey,
  integrations,
  isLoadedIntegrations,
  integrationPaginationData,
  integrationsCategoryFilter,
  activeViewTab,
  loadDynamicIntegrations,
} = useIntegrationStore()

const showComingSoonIntegrations = ref(false)

const activeCategory = ref<IntegrationCategoryItemType | null>(null)

const searchQuery = ref<string>('')

const searchInputRef = ref<HTMLInputElement>()

const integrationListRef = ref<HTMLDivElement>()

const { width: integrationListContainerWidth } = useElementSize(integrationListRef)

const upvotesData = computed(() => {
  return new Set(syncDataUpvotes.value)
})

const integrationCategoriesRef = computed(() => {
  return integrationCategories
    .filter((c) => {
      if (isEEFeatureBlocked.value && c.value !== IntegrationCategoryType.DATABASE) return false

      if (!showComingSoonIntegrations.value && !c.isAvailable) return false

      const filterByActiveCategory = activeCategory.value ? c.value === activeCategory.value.value : true

      return filterCategory(c) && filterByActiveCategory && !c.value.endsWith('-coming-soon')
    })
    .map((c) => {
      return {
        label: t(c.title),
        value: c.value,
      }
    })
})

const isOpenFilter = ref(false)

const categoriesQuery = computed({
  get: () => {
    const availableCategories = integrationCategoriesRef.value.map((c) => c.value)

    if (route.value.query.categories === undefined) {
      return integrationsCategoryFilter.value
    }

    const query = ((route.value.query.categories as string) || '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => availableCategories.includes(c))

    integrationsCategoryFilter.value = query

    router.push({ query: { ...route.value.query, categories: undefined } })

    return integrationsCategoryFilter.value
  },
  set: (value: Array<string>) => {
    if (!ncIsArray(value)) return

    integrationsCategoryFilter.value = value
  },
})

const isDataReflectionEnabled = computed(() => {
  return isFeatureEnabled(FEATURE_FLAG.DATA_REFLECTION)
})

const getIntegrationsByCategory = (category: IntegrationCategoryType, query: string) => {
  return allIntegrations.filter((i) => {
    // OSS-only integrations (e.g. SQLite) are available only on free, self-hosted deployments
    // (CE + unlicensed On-Prem) — hidden on licensed On-Prem and Cloud. isEEFeatureBlocked is
    // true exactly for that free non-cloud case. Gate on it — NOT isEeUI — since the self-hosted
    // one-docker image is an EE build (isEeUI === true) regardless of license.
    const isOssOnlyAllowed = isEEFeatureBlocked.value || !i?.isOssOnly

    if (!isDataReflectionEnabled.value && i.sub_type === SyncDataType.NOCODB) return false

    if (i.hidden) return false

    // EE-only data sources (e.g. MSSQL, Oracle) are hidden in CE; in EE they're gated by their paid add-on.
    // EE-only sources (MSSQL, Oracle) are hidden in CE and in community mode.
    if (!showEEFeatures.value && i.isEeOnly) return false

    return (
      isOssOnlyAllowed &&
      filterIntegration(i) &&
      i.type === category &&
      integrationLabel(i.title).toLowerCase().includes(query.trim().toLowerCase())
    )
  })
}

const integrationsMapByCategory = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  integrationsRefreshKey.value

  return integrationCategories
    .filter((c) => {
      if (isEEFeatureBlocked.value && c.value !== IntegrationCategoryType.DATABASE) return false

      if (!showComingSoonIntegrations.value && !c.isAvailable) return false

      const filterByActiveCategory = activeCategory.value ? c.value === activeCategory.value.value : true

      const filterByUrlQuery =
        categoriesQuery.value.includes(c.value) || categoriesQuery.value.some((q) => `${q}-coming-soon` === c.value)

      return filterCategory(c) && filterByActiveCategory && filterByUrlQuery
    })
    .reduce(
      (acc, curr) => {
        acc[curr.value] = {
          title: curr.title,
          subtitle: curr.subtitle,
          list: getIntegrationsByCategory(curr.value, searchQuery.value),
          isAvailable: curr.isAvailable,
          teleEventName: curr.teleEventName,
          value: curr.value,
        }

        return acc
      },
      {} as Record<
        string,
        {
          title: string
          subtitle?: string
          list: IntegrationItemType[]
          isAvailable?: boolean
          teleEventName?: IntegrationCategoryType
          value: IntegrationCategoryType
        }
      >,
    )
})

const hasIntegrationResults = computed(() => {
  const categories = Object.keys(integrationsMapByCategory.value)
  return categories.some((category) => integrationsMapByCategory.value[category]?.list?.length > 0)
})

const hasConnectionResults = computed(() => {
  if (!props.showActiveConnections || isModal || !integrations.value.length) return false

  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return integrations.value.length > 0

  return integrations.value.some((i) => i.title?.toLowerCase().includes(query))
})

const isEmptyList = computed(() => {
  // If active connections have results, don't show empty state
  if (hasConnectionResults.value) return false

  return !hasIntegrationResults.value
})

const isAddNewIntegrationModalOpen = computed({
  get: () => {
    return pageMode.value === IntegrationsPageMode.LIST
  },
  set: (value: boolean) => {
    if (!value) {
      pageMode.value = null
    }
  },
})

const handleUpvote = (category: IntegrationCategoryType, syncDataType: SyncDataType) => {
  if (upvotesData.value.has(syncDataType)) return

  $e(`a:integration-request:${integrationsMapByCategory.value[category]?.teleEventName || category}:${syncDataType}`)

  updateSyncDataUpvotes([...syncDataUpvotes.value, syncDataType])
}

const handleAddIntegration = async (category: IntegrationCategoryType, integration: IntegrationItemType) => {
  if (!integration.isAvailable) {
    handleUpvote(category, integration.sub_type)
    return
  }

  if (category === IntegrationCategoryType.AI && blockAiIntegrations.value) {
    showUpgradeToUseAiIntegrations({ triggerSource: 'integrations-ai-integrations' })
    return
  }

  await addIntegration(integration)
}

const isIntegrationVisible = (integration: IntegrationItemType, _category: any) => {
  if (!showComingSoonIntegrations.value && !integration.isAvailable) return false

  if (easterEggToggle.value) return true

  return !!integration.isAvailable
}

// Browse gallery, mirroring the base settings pane: categories are filter pills over one grid.
const activeBrowseCategory = ref<string>('all')

const appsCategory = IntegrationCategoryType.AUTH

/** A category is offered only when it still has something to show. */
const browseCategories = computed(() =>
  Object.values(integrationsMapByCategory.value).filter((c: any) => {
    if (!(easterEggToggle.value || c.value === IntegrationCategoryType.DATABASE || c.value === appsCategory)) return false

    const list = (c.list || []).filter((i: IntegrationItemType) => isIntegrationVisible(i, c))

    return c.value === appsCategory ? list.some(isAppIntegration) : list.length > 0
  }),
)

const browsePills = computed(() => [
  { value: 'all', title: 'general.all' },
  ...browseCategories.value.map((c: any) => ({ value: c.value, title: c.title })),
])

const browseItems = computed(() =>
  browseCategories.value
    .filter((c: any) => activeBrowseCategory.value === 'all' || c.value === activeBrowseCategory.value)
    .flatMap((c: any) => {
      const list = (c.list || []).filter((i: IntegrationItemType) => isIntegrationVisible(i, c))

      return (c.value === appsCategory ? list.filter(isAppIntegration) : list).map((i: IntegrationItemType) => ({
        integration: i,
        categoryKey: c.value,
      }))
    }),
)

// A pill the search narrowed away would strand the grid with no way back.
watch(browseItems, (items) => {
  if (!items.length && activeBrowseCategory.value !== 'all') activeBrowseCategory.value = 'all'
})

onMounted(() => {
  loadDynamicIntegrations()

  if (!integrationsCategoryFilter.value.length) {
    integrationsCategoryFilter.value = integrationCategoriesRef.value.map((c) => c.value)
  }
})

if (!isModal) {
  watch(searchInputRef, (el) => {
    if (el) {
      forcedNextTick(() => {
        searchInputRef.value?.focus()
      })
    }
  })
}

const dataReflectionEnabled = computed(() => {
  return !!activeWorkspace.value?.data_reflection_enabled
})

watch(activeViewTab, (value) => {
  if (value !== 'integrations' && isOpenFilter.value) {
    isOpenFilter.value = false
  }
})
</script>

<template>
  <component
    :is="isModal ? NcModal : 'div'"
    v-model:visible="isAddNewIntegrationModalOpen"
    centered
    size="large"
    :class="{
      'h-full': !isModal,
    }"
    wrap-class-name="nc-modal-available-integrations-list"
    @keydown.esc="isAddNewIntegrationModalOpen = false"
  >
    <a-layout>
      <a-layout-content class="nc-integration-layout-content">
        <div v-if="isModal" class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-nc-border-gray-medium">
          <NcButton type="text" size="small" @click="isAddNewIntegrationModalOpen = false">
            <GeneralIcon icon="arrowLeft" />
          </NcButton>
          <GeneralIcon icon="gitCommit" class="flex-none h-5 w-5" />
          <div class="flex-1 text-base font-weight-700">{{ $t('labels.newConnection') }}</div>
          <div class="flex items-center gap-3">
            <NcButton size="small" type="text" @click="isAddNewIntegrationModalOpen = false">
              <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
            </NcButton>
          </div>
        </div>
        <div
          class="w-full flex flex-col gap-6"
          :class="{
            'h-[calc(100%_-_66px)]': isModal,
            'h-full': !isModal,
          }"
        >
          <div v-if="integrationListContainerWidth" class="px-6 pt-4">
            <!-- Title and search share a line: search filters the whole pane. -->
            <div class="flex flex-wrap items-center justify-between gap-3 m-auto nc-content-max-w">
              <div class="flex-1 min-w-60">
                <h2 v-if="showTitle" class="text-lg font-semibold text-nc-content-gray mb-1">
                  {{ $t('general.integrations') }}
                </h2>

                <div class="text-sm font-normal text-nc-content-gray-subtle2">
                  {{ showActiveConnections ? $t('msg.manageConnectionsAndIntegrations') : $t('msg.connectIntegrations') }}
                  <a
                    class="nc-inline-doc-link"
                    href="https://nocodb.com/docs/product-docs/integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ $t('msg.learnMore') }}</a
                  >
                </div>
              </div>

              <a-input
                ref="searchInputRef"
                v-model:value="searchQuery"
                type="text"
                class="nc-input-border-on-value nc-search-integration-input !rounded-lg !py-2 !h-9 !w-full sm:!w-80 flex-none"
                :placeholder="
                  showActiveConnections
                    ? $t('placeholder.searchConnectionsOrIntegrations')
                    : `${$t('general.search')} ${$t('general.integrations').toLowerCase()}...`
                "
                allow-clear
              >
                <template #prefix>
                  <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
                </template>
              </a-input>
            </div>
          </div>

          <div
            ref="integrationListRef"
            class="flex-1 px-6 pb-8 flex flex-col nc-workspace-settings-integrations-list overflow-y-auto nc-scrollbar-thin"
          >
            <div
              v-if="integrationListContainerWidth"
              class="w-full flex justify-center"
              :class="{
                'flex-1': isEmptyList,
              }"
            >
              <div class="flex flex-col space-y-6 w-full nc-content-max-w">
                <!-- Full-page skeleton during initial load (non-modal only) -->
                <WorkspaceIntegrationsSkeleton v-if="showActiveConnections && !isModal && !isLoadedIntegrations" />

                <!-- Real content (shown after load or in modal mode) -->
                <template v-else>
                  <!-- Enterprise Vaults CTA; not in the modal reuse of this tab. -->
                  <WorkspaceIntegrationsVaultBanner
                    v-if="
                      isEeUI &&
                      showActiveConnections &&
                      !isModal &&
                      isUIAllowed('vaultList') &&
                      isFeatureEnabled(FEATURE_FLAG.ENTERPRISE_VAULTS)
                    "
                  />

                  <!-- Active connections section (shown as first section when not modal) -->
                  <WorkspaceIntegrationsActiveConnectionsSection
                    v-if="showActiveConnections && !isModal && isLoadedIntegrations && integrations.length"
                    :connections="integrations"
                    :total-count="integrationPaginationData.totalRows || 0"
                    :search-query="searchQuery"
                    show-divider
                    @view-all="emits('view-all-connections')"
                  />

                  <!-- Browse gallery: one grid, categories as filter pills -->
                  <div class="nc-browse-integrations" style="container-type: inline-size">
                    <div v-if="browsePills.length > 2" class="flex flex-wrap items-center gap-2">
                      <button
                        v-for="pill of browsePills"
                        :key="pill.value"
                        type="button"
                        class="nc-browse-pill"
                        :class="{ active: activeBrowseCategory === pill.value }"
                        :data-testid="`nc-browse-pill-${pill.value}`"
                        @click="activeBrowseCategory = pill.value"
                      >
                        {{ $t(pill.title) }}
                      </button>
                    </div>

                    <div class="nc-browse-grid">
                      <NcTooltip
                        v-for="item of browseItems"
                        :key="`${item.categoryKey}-${item.integration.sub_type}`"
                        :disabled="item.integration?.isAvailable"
                        placement="bottom"
                      >
                        <template #title>{{ $t('tooltip.comingSoonIntegration') }}</template>

                        <div
                          :tabindex="0"
                          class="nc-browse-card"
                          :data-testid="`nc-browse-card-${item.integration.sub_type}`"
                          @click="handleAddIntegration(item.categoryKey, item.integration)"
                        >
                          <span class="nc-browse-logo">
                            <GeneralIntegrationIcon :type="item.integration.sub_type" size="md" />
                          </span>

                          <span class="flex-1 min-w-0 text-left text-bodyDefaultSm font-semibold text-nc-content-gray truncate">
                            {{ integrationLabel(item.integration.title) }}
                          </span>

                          <!-- Plan gate sits on the card, not the category pill. -->
                          <span
                            v-if="item.categoryKey === IntegrationCategoryType.AI && blockAiIntegrations"
                            class="nc-browse-plan-badge flex-none"
                          >
                            <LazyPaymentUpgradeBadge
                              :feature="PlanFeatureTypes.FEATURE_AI_INTEGRATIONS"
                              :feature-enabled-callback="() => !blockAiIntegrations"
                              icon-only
                              remove-click
                            />
                          </span>

                          <!-- Data reflection is a toggle, so once on it reads as done. -->
                          <GeneralIcon
                            v-if="item.integration?.sub_type === SyncDataType.NOCODB && dataReflectionEnabled"
                            icon="ncCheck"
                            class="flex-none w-4 h-4 text-nc-content-brand"
                          />

                          <!-- Unavailable ones are a vote, not an install. -->
                          <GeneralIcon
                            v-else-if="!item.integration?.isAvailable"
                            icon="ncArrowUp"
                            class="flex-none w-4 h-4"
                            :class="
                              upvotesData.has(item.integration.sub_type) ? 'text-nc-content-brand' : 'text-nc-content-gray-muted'
                            "
                          />
                        </div>
                      </NcTooltip>

                      <!-- Always last, dotted: an ask, not a connection. -->
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

                  <div v-if="isEmptyList" class="h-full text-center flex items-center justify-center gap-3">
                    <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
                  </div>
                </template>
              </div>
            </div>
            <div v-else class="h-full flex items-center justify-center"><GeneralLoader size="xlarge" /></div>
          </div>
        </div>
        <WorkspaceIntegrationsRequestDialog />
      </a-layout-content>
    </a-layout>
  </component>
</template>

<style lang="scss" scoped>
.nc-integration-layout-sidebar {
  @apply !bg-nc-bg-default border-r-1 border-nc-border-gray-medium !min-w-[260px] !max-w-[260px];

  flex: 1 1 260px !important;

  .nc-integration-category-item {
    @apply flex gap-2 p-2 rounded-lg hover:bg-nc-bg-gray-light cursor-pointer transition-all;

    &.active {
      @apply bg-nc-bg-gray-light;
    }

    .nc-integration-category-item-icon-wrapper {
      @apply flex-none w-5 h-5 flex items-center justify-center rounded;

      .nc-integration-category-item-icon {
        @apply flex-none w-4 h-4;
      }
    }

    .nc-integration-category-item-content-wrapper {
      @apply flex-1 flex flex-col gap-1;

      .nc-integration-category-item-title {
        @apply text-sm text-nc-content-gray font-weight-500;
      }

      .nc-integration-category-item-subtitle {
        @apply text-xs text-nc-content-gray-muted font-weight-500;
      }
    }
  }
}

.source-card-request-integration {
  @apply flex flex-col gap-4 border-1 rounded-xl p-3 w-[280px] overflow-hidden transition-all duration-300 max-w-[576px];

  &.active {
    @apply w-full;
  }
  &:not(.active) {
    @apply cursor-pointer hover:bg-nc-bg-gray-extralight;

    &:hover {
      box-shadow: 0px 4px 8px -2px rgba(var(--rgb-base), 0.08), 0px 2px 4px -2px rgba(var(--rgb-base), 0.04);
    }
  }

  .source-card-item {
    @apply flex items-center gap-4;

    .name {
      @apply text-base font-semibold text-nc-content-gray;
    }
  }
}
.source-card-link {
  @apply !text-nc-content-gray-extreme !no-underline;
  .nc-new-integration-type-title {
    @apply text-sm font-weight-600 text-nc-content-gray-subtle2;
  }
}

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

          // .integration-icon-wrapper {
          //   @apply bg-nc-bg-gray-light;
          // }
        }
        &:not(.is-available) {
          &:not(:hover) {
            .integration-icon-wrapper {
              // @apply bg-nc-bg-gray-extralight;

              // .integration-icon {
              //   @apply !grayscale;

              //   filter: grayscale(100%) brightness(115%);
              // }
            }
          }

          .integration-upvote-btn {
            &.selected {
              @apply shadow-selected !text-nc-content-brand !border-nc-border-brand !cursor-not-allowed pointer-events-none;
            }
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

<style lang="scss">
.nc-modal-available-integrations-list {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
  .ant-modal-content {
    overflow: hidden;
  }
}

/* ---------- Browse integrations gallery (mirrors base settings) ---------- */

.nc-browse-integrations {
  @apply flex flex-col gap-4;
}

.nc-browse-pill {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150
    text-bodySm border-1 border-nc-border-gray-medium bg-transparent text-nc-content-gray-subtle2;

  &:hover:not(.active) {
    @apply bg-nc-bg-gray-extralight text-nc-content-gray;
  }

  &.active {
    @apply border-transparent bg-nc-fill-primary text-white;
  }
}

/* Container queries, not viewport: the pane's width is what varies here. */
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

/* Forces one box size for bare glyphs and full-bleed logo tiles alike. */
.nc-browse-logo {
  @apply flex-none flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden bg-nc-bg-gray-extralight;
}

/* Grey at rest so plan badges don't outshout the names. */
.nc-browse-plan-badge {
  filter: grayscale(1);
  opacity: 0.5;
  transition: filter 150ms ease, opacity 150ms ease;
}

.nc-browse-card:hover .nc-browse-plan-badge {
  filter: none;
  opacity: 1;
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

/* Reads as part of the sentence; shows as a link only on hover. */
.nc-inline-doc-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--nc-border-gray-dark);

  &:hover,
  &:focus-visible {
    color: var(--nc-content-brand);
    text-decoration-color: currentColor;
  }
}
</style>
