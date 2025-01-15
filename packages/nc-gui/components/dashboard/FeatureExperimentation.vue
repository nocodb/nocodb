<script setup lang="ts">
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

onUnmounted(() => {
  if (clickTimer.value) clearTimeout(clickTimer.value)
})
</script>

<template>
  <NcModal v-model:visible="value" size="small">
    <div class="flex flex-col gap-3">
      <div>
        <h1 class="text-base text-gray-800 font-semibold">
          <component :is="iconMap.bulb" class="text-gray-500 h-5 mr-1 pb-1" @click="handleClick" />
          {{ $t('general.featurePreview') }}
        </h1>
        <div class="text-gray-600 leading-5">
          {{ $t('labels.toggleExperimentalFeature') }}
        </div>
      </div>

      <div
        ref="contentRef"
        class="border-1 rounded-md min-h-[50px] max-h-[234px] nc-scrollbar-md overflow-y-auto border-gray-200"
      >
        <template v-for="feature in features" :key="feature.id">
          <div
            v-if="(!feature.isEE || isEeUI) && (!feature?.isEngineering || isEngineeringModeOn)"
            class="border-b-1 px-3 flex gap-2 flex-col py-2 border-gray-200 last:border-b-0"
          >
            <div class="flex items-center justify-between">
              <div class="text-gray-800 font-medium">
                {{ feature.title }}
              </div>
              <NcSwitch v-model:checked="selectedFeatures[feature.id]" @change="saveExperimentalFeatures" />
            </div>

            <div class="text-gray-500 leading-4 text-[13px]">
              {{ feature.description }}
            </div>
          </div>
        </template>
      </div>
    </div>
  </NcModal>
</template>
