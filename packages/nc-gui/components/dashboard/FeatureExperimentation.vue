<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'

interface Props {
  value?: boolean
}

const props = defineProps<Props>()

const { toggleFeature, features, isEngineeringModeOn } = useBetaFeatureToggle()

const value = useVModel(props, 'value')

const { appInfo } = useGlobal()

const selectedFeatures = ref<Record<string, boolean>>({})

// Add search functionality
const searchQuery = ref('')

const isEnabledOnPremFeature = (feature: BetaFeatureType) => {
  if (appInfo.value.isOnPrem && feature.isOnPrem === false) return false

  return true
}

const isFeatureVisible = (feature: BetaFeatureType) => {
  return (!feature?.isEE || isEeUI) && (!feature?.isEngineering || isEngineeringModeOn.value) && isEnabledOnPremFeature(feature)
}

const filteredFeatures = computed(() => {
  if (!searchQuery.value) return features.value

  const query = searchQuery.value.toLowerCase()

  // Helper function to calculate match score
  const getMatchScore = (feature: BetaFeatureType) => {
    const title = feature.title.toLowerCase()
    const description = feature.description.toLowerCase()

    // Exact prefix match in title (highest priority)
    if (title.startsWith(query)) return 4
    // Contains exact match in title
    if (title.includes(query)) return 3
    // Exact prefix match in description
    if (description.startsWith(query)) return 2
    // Contains exact match in description
    if (description.includes(query)) return 1
    // No match
    return 0
  }

  return features.value
    .filter((feature) => {
      if (!isFeatureVisible(feature)) return false

      const title = feature.title.toLowerCase()
      const description = feature.description.toLowerCase()
      return title.includes(query) || description.includes(query)
    })
    .sort((a, b) => {
      const scoreA = getMatchScore(a)
      const scoreB = getMatchScore(b)
      return scoreB - scoreA
    })
})

const isAllFeaturesEnabled = computed({
  get: () => {
    return features.value.every((feature) => {
      return !isFeatureVisible(feature) || selectedFeatures.value[feature.id]
    })
  },
  set: (value: boolean) => {
    features.value.forEach((feature) => {
      if (isFeatureVisible(feature) && feature.enabled !== value) {
        if (toggleFeature(feature.id, value)) {
          selectedFeatures.value[feature.id] = value
        }
      }
    })
  },
})

const saveExperimentalFeatures = () => {
  features.value.forEach((feature) => {
    if (selectedFeatures.value[feature.id] !== feature.enabled) {
      toggleFeature(feature.id)
    }
  })
}

onMounted(() => {
  selectedFeatures.value = Object.fromEntries(features.value.map((feature) => [feature.id, feature.enabled]))
})

watch(value, (val) => {
  if (val) {
    selectedFeatures.value = Object.fromEntries(features.value.map((feature) => [feature.id, feature.enabled]))
  }
})

const clickCount = ref(0)
const clickTimer = ref<NodeJS.Timeout | undefined>(undefined)
const handleClick = () => {
  clickCount.value++

  if (clickCount.value === 1) {
    if (clickTimer.value) clearTimeout(clickTimer.value)
    clickTimer.value = setTimeout(() => {
      clickCount.value = 0
    }, 3000)
  }

  if (clickCount.value >= 3) {
    isEngineeringModeOn.value = !isEngineeringModeOn.value
    clickCount.value = 0
    if (clickTimer.value) {
      clearTimeout(clickTimer.value)
      clickTimer.value = undefined
    }
  }
}

onKeyDown('Alt', (e) => {
  if (e.shiftKey) {
    value.value = !value.value
  }
})

onUnmounted(() => {
  if (clickTimer.value) clearTimeout(clickTimer.value)
})
</script>

<template>
  <a-drawer
    v-model:visible="value"
    class="nc-features-drawer"
    :mask-style="{ background: 'transparent' }"
    width="min(32vw, 458px)"
    :closable="false"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-3 px-2 !pl-4 border-b-1 h-[var(--toolbar-height)] flex-none border-gray-200">
        <component :is="iconMap.bulb" class="text-gray-700 opacity-85 h-5 w-5" @click="handleClick" />
        <h1 class="text-base !text-gray-700 font-weight-700 p-0 m-0">
          {{ $t('general.featurePreview') }}
        </h1>
        <nc-button type="text" class="!w-8 !h-8 !min-w-0 ml-auto" @click="value = false">
          <GeneralIcon icon="close" class="!text-gray-700" />
        </nc-button>
      </div>

      <div class="text-sm font-weight-500 text-gray-600 leading-5 m-4 mb-0 flex items-center justify-between gap-3 pr-3">
        <span>
          {{ $t('labels.toggleExperimentalFeature') }}
        </span>
        <NcTooltip
          :title="
            isAllFeaturesEnabled
              ? `${$t('general.disable')} ${$t('general.all')}`
              : `${$t('general.enable')} ${$t('general.all')}`
          "
          class="flex"
        >
          <NcSwitch v-model:checked="isAllFeaturesEnabled" />
        </NcTooltip>
      </div>

      <div class="h-full overflow-y-auto nc-scrollbar-thin flex-grow p-4 !rounded-lg">
        <div ref="contentRef" class="!rounded-lg">
          <div class="sticky top-0 bg-white z-10 mb-2">
            <a-input v-model:value="searchQuery" type="text" placeholder="Search features..." class="nc-input-sm nc-input-shadow">
              <template #prefix>
                <GeneralIcon
                  :class="{
                    'text-nc-content-brand': searchQuery?.length,
                  }"
                  icon="search"
                  class="nc-search-icon h-3.5 w-3.5 mr-1"
                />
              </template>
            </a-input>
          </div>
          <div
            v-if="filteredFeatures?.length"
            class="border-1 !border-gray-200 !rounded-lg max-h-[calc(100vh-200px)] overflow-y-auto nc-scrollbar-thin"
          >
            <div class="flex flex-col">
              <template v-for="feature in filteredFeatures" :key="feature.id">
                <div
                  v-if="isFeatureVisible(feature)"
                  class="border-b-1 px-3 flex gap-2 flex-col py-2 !border-gray-200 last:border-b-0"
                >
                  <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-800 !font-weight-600">
                      {{ feature.title }}
                    </div>
                    <NcSwitch v-model:checked="selectedFeatures[feature.id]" @change="saveExperimentalFeatures" />
                  </div>

                  <div class="text-gray-500 leading-4 text-[13px] font-weight-500">
                    {{ feature.description }}
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div v-else class="px-2 py-6 text-center text-gray-500 flex flex-col items-center gap-6">
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              alt="No search results found"
            />

            {{ features?.length ? $t('title.noResultsMatchedYourSearch') : 'The list is empty' }}
          </div>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<style lang="scss">
.nc-features-drawer {
  .ant-drawer-content-wrapper {
    @apply !rounded-l-xl overflow-hidden mt-[48px] h-[calc(100vh_-_48px)];
    .ant-drawer-body {
      @apply p-0;
    }
  }
}

:deep(.field-list-with-search) {
  .nc-divider {
    display: none !important;
  }

  .nc-toolbar-dropdown-search-field-input {
    @apply rounded-lg;
  }

  .nc-list-item {
    @apply h-8 hover:bg-nc-background-grey-light gap-x-1.5;
  }
}
</style>
