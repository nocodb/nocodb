<script setup lang="ts">
import { IntegrationCategoryType } from 'nocodb-sdk'

// Auth-provider databases carry no manifest `order`, so they otherwise sort last.
// The list is explicit because nothing in the manifest tells them apart from the
// OAuth providers they sit beside.
const AUTH_DATABASE_SUB_TYPES = ['postgres', 'mysql', 'mssql', 'redis', 'clickhouse']

interface Props {
  /**
   * 'workspace' shows all available categories, 'base' shows only Database,
   * 'ai' shows only what an agent can act through — Auth Provider then AI.
   */
  mode?: 'workspace' | 'base' | 'ai'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'workspace',
})

const { t } = useI18n()

const { addIntegration, integrations } = useIntegrationStore()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isEEFeatureBlocked, showEEFeatures } = useEeConfig()

const isOpen = ref(false)

const easterEggToggle = computed(() => isFeatureEnabled(FEATURE_FLAG.INTEGRATIONS))

// Count connections per sub_type
const connectedCountMap = computed(() => {
  const map: Record<string, number> = {}

  for (const integration of integrations.value) {
    if (integration.sub_type) {
      map[integration.sub_type] = (map[integration.sub_type] || 0) + 1
    }
  }

  return map
})

// Category filter — mirrors the main page logic for each mode
const isCategoryAllowed = (cat: (typeof integrationCategories)[number]) => {
  if (!cat.isAvailable) return false

  if (props.mode === 'ai') {
    // The Database category is our own external data-source connections, which an
    // agent cannot act through. The databases it can reach are auth providers.
    return cat.value === IntegrationCategoryType.AUTH || cat.value === IntegrationCategoryType.AI
  }

  if (props.mode === 'base') {
    // Base level: same as base/Integrations.vue integrationsMap — Database + AI + Auth only
    return (
      cat.value === IntegrationCategoryType.DATABASE ||
      cat.value === IntegrationCategoryType.AI ||
      cat.value === IntegrationCategoryType.AUTH
    )
  }

  // Workspace level: same as IntegrationsTab — respect EE blocking + feature flag
  if (isEEFeatureBlocked.value && cat.value !== IntegrationCategoryType.DATABASE) return false

  if (!easterEggToggle.value) {
    if (cat.value !== IntegrationCategoryType.DATABASE && cat.value !== IntegrationCategoryType.AUTH) {
      return false
    }
  }

  return true
}

// Integration filter — mirrors the main page logic for each mode
const isIntegrationAllowed = (i: (typeof allIntegrations)[number], _category: (typeof integrationCategories)[number]) => {
  if (i.hidden) return false
  if (!i.isAvailable) return false
  if (i.sub_type === SyncDataType.NOCODB) return false
  // EE-only data sources (e.g. MSSQL, Oracle) are hidden in CE; in EE they're gated by their paid add-on.
  // EE-only sources (MSSQL, Oracle) are hidden in CE and in community mode.
  if (!showEEFeatures.value && i.isEeOnly) return false
  // OSS-only integrations (e.g. SQLite) only on free, self-hosted (CE + unlicensed On-Prem);
  // hidden on licensed On-Prem and Cloud. isEEFeatureBlocked is true exactly for that case.
  if (!isEEFeatureBlocked.value && i.isOssOnly) return false

  return true
}

const authDatabaseRank = (subType: string) => {
  const i = AUTH_DATABASE_SUB_TYPES.indexOf(subType)
  return i === -1 ? AUTH_DATABASE_SUB_TYPES.length : i
}

// Categories in the order they are offered. `ai` leads with Auth Provider — the
// connections an agent reaches through — and keeps the model credentials below.
const allowedCategories = computed(() => {
  const cats = integrationCategories.filter((c) => isCategoryAllowed(c))

  if (props.mode !== 'ai') return cats

  return cats.sort((a, b) => Number(a.value !== IntegrationCategoryType.AUTH) - Number(b.value !== IntegrationCategoryType.AUTH))
})

// Build the list of available integrations for NcList
const integrationListItems = computed(() => {
  const items: NcListItemType[] = []

  for (const cat of allowedCategories.value) {
    const categoryIntegrations = allIntegrations.filter((i) => i.type === cat.value && isIntegrationAllowed(i, cat))

    if (!categoryIntegrations.length) continue

    // Stable, so the manifest order the store already applied survives for the rest.
    if (props.mode === 'ai' && cat.value === IntegrationCategoryType.AUTH) {
      categoryIntegrations.sort((a, b) => authDatabaseRank(a.sub_type) - authDatabaseRank(b.sub_type))
    }

    for (const integration of categoryIntegrations) {
      items.push({
        value: integration.sub_type,
        label: integrationLabel(integration.title),
        ncGroupHeaderLabel: t(cat.title),
        integration,
        connectedCount: connectedCountMap.value[integration.sub_type] || 0,
      })
    }
  }

  return items
})

const categoryGroupOrder = computed(() => allowedCategories.value.map((c) => t(c.title)))

const handleSelect = (option: NcListItemType) => {
  if (option?.integration) {
    addIntegration(option.integration)
    isOpen.value = false
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" placement="bottomRight">
    <slot>
      <NcButton v-e="['c:integration:add-connection']" size="small" data-testid="nc-add-connection-btn">
        <GeneralIcon icon="plus" class="mr-1" />
        {{ t('labels.addConnection') }}
      </NcButton>
    </slot>
    <template #overlay>
      <NcList
        v-model:open="isOpen"
        :list="integrationListItems"
        :group-order="categoryGroupOrder"
        :search-input-placeholder="`${t('general.search')} ${t('general.integrations').toLowerCase()}...`"
        option-value-key="value"
        option-label-key="label"
        :show-selected-option="false"
        :close-on-select="true"
        :item-height="36"
        class="nc-add-connection-list w-72 !h-auto"
        @change="handleSelect"
      >
        <template #listItem="{ option }">
          <div class="flex items-center gap-2 w-full">
            <div class="flex-none h-7 w-7 rounded-lg flex items-center justify-center">
              <GeneralIntegrationIcon :type="option.value" size="lg" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-nc-content-gray truncate">
                {{ option.label }}
              </div>
              <div v-if="option.connectedCount" class="text-xs text-nc-content-brand">
                {{ option.connectedCount }} {{ t('general.connected').toLowerCase() }}
              </div>
            </div>
          </div>
        </template>
      </NcList>
    </template>
  </NcDropdown>
</template>
