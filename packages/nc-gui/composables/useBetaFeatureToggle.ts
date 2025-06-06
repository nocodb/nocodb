import { onMounted, ref } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import rfdc from 'rfdc'

const deepClone = rfdc()
const FEATURES = [
  {
    id: 'infinite_scrolling',
    title: 'Infinite scrolling',
    description: 'Effortlessly browse large datasets with infinite scrolling.',
    enabled: true,
    version: 1,
  },
  {
    id: 'canvas_grid_view',
    title: 'Improved Grid View',
    description: 'High-performance grid view with enhanced scrolling and rendering capabilities.',
    enabled: !ncIsPlaywright(),
    version: 1,
  },
  {
    id: 'canvas_group_grid_view',
    title: 'Improved Group By',
    description: 'New and Improved groupby in grid view with enhanced scrolling and rendering capabilities.',
    enabled: !ncIsPlaywright(),
    version: 1,
  },
  {
    id: 'improved_sidebar_ui',
    title: 'Improved Sidebar',
    description: 'New and Improved sidebar for better UI experience',
    enabled: !ncIsPlaywright(),
    version: 2,
  },
  {
    id: 'link_to_another_record',
    title: 'Link To Another Record',
    description: 'Show linked record display value in Link fields.',
    enabled: false,
    version: 1,
  },
  {
    id: 'model_context_protocol',
    title: 'Model Context Protocol',
    description: 'Connect NocoDB base to Claude AI, Windsurf AI, and more.',
    enabled: false,
    version: 1,
    isEngineering: true,
  },
  {
    id: 'payment',
    title: 'Payment Flows',
    description: 'Enable NocoDB Payment Flows.',
    enabled: false,
    version: 1,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'ai_features',
    title: 'AI features',
    description: 'Unlock AI features to enhance your NocoDB experience.',
    enabled: false,
    version: 1,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'nocodb_scripts',
    title: 'NocoDB Scripts (Beta)',
    description: 'Enable NocoDB Scripts to automate repetitive workflow',
    enabled: false,
    version: 1,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Enable dynamic integrations.',
    enabled: false,
    version: 1,
    isEngineering: true,
  },
  {
    id: 'data_reflection',
    title: 'Data reflection',
    description: 'Enable data reflection.',
    enabled: false,
    version: 1,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'import_from_nocodb',
    title: 'OSS to Enterprise migration',
    description: 'Enable import from NocoDB OSS instance to Enterprise Edition.',
    enabled: true,
    version: 1,
    isEE: true,
  },
  {
    id: 'sync',
    title: 'Sync',
    description: 'Enable sync feature.',
    enabled: false,
    version: 1,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'geodata_column',
    title: 'Geodata column',
    description: 'Enable the geodata column.',
    enabled: false,
    version: 1,
    isEngineering: true,
  },
  {
    id: 'form_support_column_scanning',
    title: 'Scanner for filling data in forms',
    description: 'Enable scanner to fill data in forms.',
    enabled: false,
    version: 1,
    isEngineering: true,
  },
  {
    id: 'extensions',
    title: 'Extensions',
    description: 'Extensions allows you to add new features or functionalities to the NocoDB platform.',
    enabled: ncIsPlaywright(),
    version: 2,
    isEngineering: true,
  },
  {
    id: 'attachment_carousel_comments',
    title: 'Comments in attachment carousel',
    description: 'Enable comments in attachment carousel.',
    enabled: false,
    version: 1,
    isEngineering: true,
  },
  {
    id: 'expanded_form_file_preview_mode',
    title: 'Expanded form file preview mode',
    description: 'Preview mode allows you to see attachments inline',
    enabled: true,
    version: 2,
    isEE: true,
  },
  {
    id: 'expanded_form_discussion_mode',
    title: 'Expanded form discussion mode',
    description: 'Discussion mode allows you to see the comments and records audits combined in one place',
    enabled: true,
    version: 2,
    isEE: true,
  },
  {
    id: 'language',
    title: 'Language',
    description: 'Community/AI Translated',
    enabled: false,
    version: 1,
    isEngineering: true,
    isEE: true,
  },
  {
    id: 'cross_base_link',
    title: 'Cross Base Link',
    description: 'Enables link creation between tables in different bases.',
    enabled: false,
    version: 1,
    isEE: true,
  },
  {
    id: 'custom_link',
    title: 'Custom Link',
    description: 'Allows user to create custom links using existing fields.',
    enabled: false,
    version: 1,
    isEE: true,
  },
] as const

export const FEATURE_FLAG = Object.fromEntries(FEATURES.map((feature) => [feature.id.toUpperCase(), feature.id])) as Record<
  Uppercase<(typeof FEATURES)[number]['id']>,
  (typeof FEATURES)[number]['id']
>

export type BetaFeatureId = (typeof FEATURES)[number]['id']
export type BetaFeatureType = (typeof FEATURES)[number]

const STORAGE_KEY = 'featureToggleStates'

export const useBetaFeatureToggle = createSharedComposable(() => {
  const features = ref<BetaFeatureType[]>(deepClone(FEATURES))

  const featureStates = computed(() => {
    return features.value.reduce((acc, feature) => {
      acc[feature.id] = feature.isEE && !isEeUI ? false : feature.enabled
      return acc
    }, {} as Record<BetaFeatureId, boolean>)
  })

  const { $e } = useNuxtApp()

  const isEngineeringModeOn = ref(false)

  const saveFeatures = () => {
    try {
      const featuresToSave = features.value.map((feature) => ({
        id: feature.id,
        enabled: feature.enabled,
        version: feature.version,
      }))

      localStorage.setItem(STORAGE_KEY, JSON.stringify(featuresToSave))
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    } catch (error) {
      console.error('Failed to save features:', error)
    }
  }

  const toggleFeature = (id: BetaFeatureId, forceUpdate?: boolean) => {
    const feature = features.value.find((f) => f.id === id)
    if (feature) {
      if (forceUpdate !== undefined) {
        feature.enabled = forceUpdate
      } else {
        feature.enabled = !feature.enabled
      }
      $e(`a:feature-preview:${id}:${feature.enabled ? 'on' : 'off'}`)
      saveFeatures()

      return true
    } else {
      console.error(`Feature ${id} not found`)
    }
  }

  const isFeatureEnabled = (id: BetaFeatureId) => featureStates.value[id] ?? false

  const initializeFeatures = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedFeatures = JSON.parse(stored) as Array<{
          id: string
          enabled: boolean
          version?: number
        }>

        features.value = FEATURES.map((defaultFeature) => {
          const storedFeature = parsedFeatures.find((f) => f.id === defaultFeature.id)

          if (!storedFeature) {
            return { ...defaultFeature }
          }

          const storedVersion = storedFeature.version || 1
          const currentVersion = defaultFeature.version || 1

          if (storedVersion < currentVersion) {
            console.log(`Feature ${defaultFeature.id} updated from v${storedVersion} to v${currentVersion}`)
            return {
              ...defaultFeature,
            }
          }
          return {
            ...defaultFeature,
            enabled: storedFeature.enabled,
          }
        })
      } else {
        features.value = deepClone(FEATURES)
      }
    } catch (error) {
      console.error('Failed to initialize features:', error)
      features.value = deepClone(FEATURES)
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

  return {
    features,
    toggleFeature,
    isFeatureEnabled,
    isEngineeringModeOn,
  }
})
