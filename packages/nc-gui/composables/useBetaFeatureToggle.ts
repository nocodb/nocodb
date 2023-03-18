import { reactive } from 'vue'

const storedValue = localStorage.getItem('betaFeatureToggleState')

const initialToggleState = storedValue ? JSON.parse(storedValue) : false

const betaFeatureToggleState = reactive({ show: initialToggleState })

const toggleBetaFeature = () => {
  betaFeatureToggleState.show = !betaFeatureToggleState.show
  localStorage.setItem('betaFeatureToggleState', JSON.stringify(betaFeatureToggleState.show))
}

const _useBetaFeatureToggle = () => {
  return {
    betaFeatureToggleState,
    toggleBetaFeature,
  }
}

const useBetaFeatureToggle = createSharedComposable(_useBetaFeatureToggle)
export { useBetaFeatureToggle }
