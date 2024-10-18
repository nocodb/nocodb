import { reactive } from 'vue'
import { createSharedComposable } from '@vueuse/core'

export const BetaFeatures = {
  FALLBACK_GRID_PAGINATED_SCROLL: 'fallback_grid_paginated_scroll',
  ENABLE_GEO_COLUMN: 'geo_column',
  FORM_SUPPORT_COLUMN_SCANNING: 'form_support_column_scanning',
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
