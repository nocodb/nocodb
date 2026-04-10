<script setup lang="ts">
import { IntegrationCategoryType } from 'nocodb-sdk'

interface Props {
  /** 'workspace' shows all available categories, 'base' shows only Database */
  mode?: 'workspace' | 'base'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'workspace',
})

const { t } = useI18n()

const { addIntegration, integrations, availableSyncAuthIntegrationSubtypes } = useIntegrationStore()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isSyncFeatureEnabled } = storeToRefs(useSyncStore())

const { isEEFeatureBlocked } = useEeConfig()

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
    if (cat.value !== IntegrationCategoryType.DATABASE) {
      if (!(isSyncFeatureEnabled.value && cat.value === IntegrationCategoryType.AUTH)) {
        return false
      }
    }
  }

  return true
}

// Integration filter — mirrors the main page logic for each mode
const isIntegrationAllowed = (i: (typeof allIntegrations)[number], category: (typeof integrationCategories)[number]) => {
  if (i.hidden) return false
  if (!i.isAvailable) return false
  if (i.sub_type === SyncDataType.NOCODB) return false
  if (isEeUI && i.isOssOnly) return false

  // Auth category: always filter by available sync auth subtypes
  if (isSyncFeatureEnabled.value && category.value === IntegrationCategoryType.AUTH) {
    return availableSyncAuthIntegrationSubtypes.value.includes(i.sub_type)
  }

  return true
}

// Build the list of available integrations for NcList
const integrationListItems = computed(() => {
  const items: NcListItemType[] = []

  for (const cat of integrationCategories) {
    if (!isCategoryAllowed(cat)) continue

    const categoryIntegrations = allIntegrations.filter((i) => i.type === cat.value && isIntegrationAllowed(i, cat))

    if (!categoryIntegrations.length) continue

    for (const integration of categoryIntegrations) {
      items.push({
        value: integration.sub_type,
        label: t(integration.title),
        ncGroupHeaderLabel: t(cat.title),
        integration,
        connectedCount: connectedCountMap.value[integration.sub_type] || 0,
      })
    }
  }

  return items
})

// Group order matching integrationCategories array order
const categoryGroupOrder = computed(() => {
  return integrationCategories.filter((c) => isCategoryAllowed(c)).map((c) => t(c.title))
})

const handleSelect = (option: NcListItemType) => {
  if (option?.integration) {
    addIntegration(option.integration)
    isOpen.value = false
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" placement="bottomRight">
    <NcButton v-e="['c:integration:add-connection']" size="small" data-testid="nc-add-connection-btn">
      <GeneralIcon icon="plus" class="mr-1" />
      {{ t('labels.addConnection') }}
    </NcButton>
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
