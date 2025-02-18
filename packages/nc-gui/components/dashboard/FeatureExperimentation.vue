<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'

interface Props {
  value?: boolean
}

const props = defineProps<Props>()

const { toggleFeature, features, isEngineeringModeOn } = useBetaFeatureToggle()

const value = useVModel(props, 'value')

const selectedFeatures = ref<Record<string, boolean>>({})

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

      <div class="text-sm font-weight-500 text-gray-600 leading-5 m-4 mb-0">
        {{ $t('labels.toggleExperimentalFeature') }}
      </div>

      <div class="h-full overflow-y-auto nc-scrollbar-thin flex-grow m-4 !rounded-lg">
        <div ref="contentRef" class="border-1 !border-gray-200 !rounded-lg">
          <template v-for="feature in features" :key="feature.id">
            <div
              v-if="(!feature.isEE || isEeUI) && (!feature?.isEngineering || isEngineeringModeOn)"
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
</style>
