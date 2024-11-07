import { reactive } from 'vue'
import { createSharedComposable } from '@vueuse/core'

export const BetaFeatures = {
  GRID_INFINITE_SCROLL: 'grid_infinite_scroll',
} as const

type BetaFeature = (typeof BetaFeatures)[keyof typeof BetaFeatures]

type FeatureToggleStates = {
  [K in BetaFeature]: boolean
}

const STORAGE_KEY = 'betaFeatureToggleStates'

export const useBetaFeatureToggle = createSharedComposable(() => {
  const storedValue = localStorage.getItem(STORAGE_KEY)

  const initialToggleStates: FeatureToggleStates = storedValue
    ? JSON.parse(storedValue)
    : (Object.fromEntries(Object.values(BetaFeatures).map((feature) => [feature, false])) as FeatureToggleStates)

  const betaFeatureToggleStates = reactive<FeatureToggleStates>(initialToggleStates)

  const toggleBetaFeature = (featureName: BetaFeature): void => {
    betaFeatureToggleStates[featureName] = !betaFeatureToggleStates[featureName]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(betaFeatureToggleStates))
  }

  return {
    betaFeatureToggleStates,
    toggleBetaFeature,
  }
})
