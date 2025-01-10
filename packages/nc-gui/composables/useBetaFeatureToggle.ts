import { onMounted, ref } from 'vue'
import { createSharedComposable } from '@vueuse/core'

const FEATURES = [
  {
    id: 'infinite_scrolling',
    title: 'Infinite scrolling',
    description: 'Effortlessly browse large datasets with infinite scrolling.',
    enabled: true,
  },
  {
    id: 'ai_features',
    title: 'AI features',
    description: 'Unlock AI features to enhance your NocoDB experience.',
    enabled: false,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Enable dynamic integrations.',
    enabled: false,
    isEngineering: true,
  },
  {
    id: 'geodata_column',
    title: 'Geodata column',
    description: 'Enable the geodata column.',
    enabled: false,
    isEngineering: true,
  },
  {
    id: 'form_support_column_scanning',
    title: 'Scanner for filling data in forms',
    description: 'Enable scanner to fill data in forms.',
    enabled: false,
    isEngineering: true,
  },
  {
    id: 'extensions',
    title: 'Extensions',
    description: 'Extensions allows you to add new features or functionalities to the NocoDB platform.',
    enabled: (window as any)?.isPlaywright,
    isEngineering: true,
  },
  {
    id: 'attachment_carousel_comments',
    title: 'Comments in attachment carousel',
    description: 'Enable comments in attachment carousel.',
    enabled: false,
    isEngineering: true,
  },
  {
    id: 'calendar_view_range',
    title: 'Allow configuring Date Time Field as End Date for Calendar View',
    description: 'Enables the calendar to display items as date ranges by allowing configuration of both start and end dates. ',
    enabled: false,
    isEE: true,
    isEngineering: true,
  },
  {
    id: 'expanded_form_file_preview_mode',
    title: 'Expanded form file preview mode',
    description: 'Preview mode allow you to see attachments inline',
    enabled: false,
    isEE: true,
    isEngineering: true,
  },
  {
    id: 'expanded_form_record_audits',
    title: 'Expanded form record audits',
    description: 'Record audits allow you to see each change on a record and who made it',
    enabled: false,
    isEE: true,
    isEngineering: true,
  },
  {
    id: 'language',
    title: 'Language',
    description: 'Community/AI Translated',
    enabled: false,
    isEngineering: true,
    isEE: true,
  },
] as const

export const FEATURE_FLAG = Object.fromEntries(FEATURES.map((feature) => [feature.id.toUpperCase(), feature.id])) as Record<
  Uppercase<(typeof FEATURES)[number]['id']>,
  (typeof FEATURES)[number]['id']
>

type FeatureId = (typeof FEATURES)[number]['id']
type Feature = (typeof FEATURES)[number]

const STORAGE_KEY = 'featureToggleStates'

export const useBetaFeatureToggle = createSharedComposable(() => {
  const features = ref<Feature[]>(structuredClone(FEATURES))

  const featureStates = computed(() => {
    return features.value.reduce((acc, feature) => {
      acc[feature.id] = feature.isEE && !isEeUI ? false : feature.enabled
      return acc
    }, {} as Record<FeatureId, boolean>)
  })

  const { $e } = useNuxtApp()

  const isEngineeringModeOn = ref(false)

  const saveFeatures = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(features.value))
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    } catch (error) {
      console.error('Failed to save features:', error)
    }
  }

  const toggleFeature = (id: FeatureId) => {
    const feature = features.value.find((f) => f.id === id)
    if (feature) {
      feature.enabled = !feature.enabled
      $e(`a:feature-preview:${id}:${feature.enabled ? 'on' : 'off'}`)
      saveFeatures()
    } else {
      console.error(`Feature ${id} not found`)
    }
  }

  const isFeatureEnabled = (id: FeatureId) => featureStates.value[id] ?? false

  const initializeFeatures = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedFeatures = JSON.parse(stored) as Partial<Feature>[]
        features.value = FEATURES.map((defaultFeature) => ({
          ...defaultFeature,
          enabled: parsedFeatures.find((f) => f.id === defaultFeature.id)?.enabled ?? defaultFeature.enabled,
        }))
      }
    } catch (error) {
      console.error('Failed to initialize features:', error)
    }
    saveFeatures()
  }

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue !== null) {
      if (JSON.parse(event.newValue) !== features.value) {
        initializeFeatures()
      }
    }
  }

  onMounted(() => {
    initializeFeatures()
    window.addEventListener('storage', handleStorageEvent)
  })

  onUnmounted(() => {
    window.removeEventListener('storage', handleStorageEvent)
  })

  onMounted(initializeFeatures)

  return {
    features,
    toggleFeature,
    isFeatureEnabled,
    isEngineeringModeOn,
  }
})
