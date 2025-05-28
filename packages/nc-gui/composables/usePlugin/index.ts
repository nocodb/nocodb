import type { ExtensionManifest, PluginManifest, ScriptManifest } from './interface'

export enum PluginLib {
  assets = 'assets',
  modules = 'modules',
  markdowns = 'markdownModules',
  scripts = 'scripts',
}

export enum PluginType {
  extension = 'extension',
  script = 'script',
}

interface PluginTypeConfig {
  basePath: string
  supportedLibs: PluginLib[]
}

const PLUGIN_TYPE_CONFIGS: Record<PluginType, PluginTypeConfig> = {
  [PluginType.extension]: {
    basePath: '../../extensions/',
    supportedLibs: [PluginLib.assets, PluginLib.modules, PluginLib.markdowns],
  },
  [PluginType.script]: {
    basePath: '../../scripts/',
    supportedLibs: [PluginLib.assets, PluginLib.modules, PluginLib.markdowns, PluginLib.scripts],
  },
}

type PluginAssetStorage = {
  [P in PluginType]: {
    [L in PluginLib]?: Record<string, any>
  }
}

export const usePlugin = createSharedComposable(() => {
  const pluginGlobs = {
    [PluginType.extension]: {
      [PluginLib.assets]: import.meta.glob('../../extensions/*/assets/*', {
        query: '?url',
        import: 'default',
      }),
      [PluginLib.modules]: import.meta.glob('../../extensions/*/*.json', {
        import: 'default',
      }),
      [PluginLib.markdowns]: import.meta.glob('../../extensions/*/*.md', {
        query: '?raw',
        import: 'default',
      }),
    },
    [PluginType.script]: {
      [PluginLib.assets]: import.meta.glob('../../scripts/*/assets/*', {
        query: '?url',
        import: 'default',
      }),
      [PluginLib.modules]: import.meta.glob('../../scripts/*/*.json', {
        import: 'default',
      }),
      [PluginLib.markdowns]: import.meta.glob('../../scripts/*/*.md', {
        query: '?raw',
        import: 'default',
      }),
      [PluginLib.scripts]: import.meta.glob('../../scripts/*/index.js', {
        query: '?raw',
        import: 'default',
      }),
    },
  } as const

  const pluginAssets: PluginAssetStorage = {
    [PluginType.extension]: {
      [PluginLib.assets]: {} as Record<string, string>,
      [PluginLib.modules]: {} as Record<string, ExtensionManifest>,
      [PluginLib.markdowns]: {} as Record<string, string>,
    },
    [PluginType.script]: {
      [PluginLib.assets]: {} as Record<string, string>,
      [PluginLib.modules]: {} as Record<string, ScriptManifest>,
      [PluginLib.markdowns]: {} as Record<string, string>,
      [PluginLib.scripts]: {} as Record<string, string>,
    },
  }

  const pluginsLoaded = ref(false)
  const availableExtensions = ref<ExtensionManifest[]>([])
  const availableScripts = ref<ScriptManifest[]>([])

  const pluginCollections = {
    [PluginType.extension]: {
      available: availableExtensions,
      disabledCount: 0,
    },
    [PluginType.script]: {
      available: availableScripts,
      disabledCount: 0,
    },
  }

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const availablePlugins = computed<PluginManifest[]>(() => [...availableExtensions.value, ...availableScripts.value])

  const availableExtensionIds = computed(() => availableExtensions.value.map((e) => e.id))
  const availableScriptIds = computed(() => availableScripts.value.map((s) => s.id))

  const pluginDescriptionContent = ref<Record<string, string>>({})
  const scriptContent = ref<Record<string, string>>({})

  /**
   * Get asset URL for a plugin
   * @param pathOrUrl The asset path or URL
   * @param type The plugin type (extension or script)
   * @returns The asset URL
   */
  const getPluginAssetUrl = (pathOrUrl: string, type: PluginType = PluginType.extension) => {
    if (pathOrUrl.startsWith('http')) {
      return pathOrUrl
    } else {
      const basePath = type === PluginType.extension ? '../../extensions/' : '../../scripts/'
      const file = pluginAssets[type][PluginLib.assets]?.[`${basePath}${pathOrUrl}`]
      return file || ''
    }
  }

  /**
   * Get script content for a script plugin
   * @param scriptId The script ID
   * @returns The script content
   */
  const getScriptContent = (scriptId: string) => {
    return scriptContent.value[scriptId] || ''
  }

  /**
   * Process a plugin manifest
   * @param path Path to the plugin manifest
   * @param manifest The plugin manifest object
   * @param type The plugin type
   */
  const processPluginManifest = (path: string, manifest: PluginManifest, type: PluginType) => {
    try {
      // Set plugin type
      manifest.type = type

      // Initialize links array if not present
      if (!Array.isArray(manifest.links)) {
        manifest.links = []
      }

      // For extensions, ensure config.modalSize exists
      if (type === PluginType.extension) {
        const extManifest = manifest as ExtensionManifest
        if (!extManifest?.config || !extManifest?.config?.modalSize) {
          extManifest.config = {
            ...(extManifest.config || {}),
            modalSize: 'lg',
          }
        }
      }

      if (manifest?.disabled !== true && (!manifest?.beta || isFeatureEnabled(FEATURE_FLAG.EXTENSIONS))) {
        // Add to available plugins collection
        pluginCollections[type].available.value.push(manifest as any)

        // Handle plugin description markdown
        if (manifest.description && manifest.id) {
          const basePath = type === PluginType.extension ? '../../extensions/' : '../../scripts/'
          const markdownPath = `${basePath}${manifest.description}`

          if (pluginAssets[type][PluginLib.markdowns]?.[markdownPath]) {
            try {
              const markdownContent = pluginAssets[type][PluginLib.markdowns]?.[markdownPath]
              pluginDescriptionContent.value[manifest.id] = `${markdownContent}`
            } catch (markdownError) {
              console.error(`Failed to load Markdown file at ${markdownPath}:`, markdownError)
            }
          }
        }

        // For scripts, load the script content
        if (type === PluginType.script && (manifest as ScriptManifest).entry && manifest.id) {
          const scriptManifest = manifest as ScriptManifest
          const scriptPath = `../../scripts/${scriptManifest.entry}`

          if (pluginAssets[type][PluginLib.scripts]?.[scriptPath]) {
            try {
              const scriptFileContent = pluginAssets[type][PluginLib.scripts]?.[scriptPath]
              scriptContent.value[manifest.id] = `${scriptFileContent}`
            } catch (scriptError) {
              console.error(`Failed to load script file at ${scriptPath}:`, scriptError)
            }
          }
        }
      } else {
        // Increment disabled count
        pluginCollections[type].disabledCount++
      }
    } catch (error) {
      console.error(`Failed to process ${type} manifest at ${path}:`, error)
    }
  }

  /**
   * Load all plugins (extensions and scripts)
   */
  const loadPlugins = async () => {
    try {
      // Reset counters
      for (const collection of Object.values(pluginCollections)) {
        collection.disabledCount = 0
      }

      // Step 1: Load assets for all plugin types
      for (const pluginType of Object.keys(pluginGlobs) as PluginType[]) {
        for (const [libKey, glob] of Object.entries(pluginGlobs[pluginType])) {
          if (!glob) continue

          for (const path of Object.keys(glob)) {
            if (!glob[path]) continue

            try {
              const lib = libKey as PluginLib
              if (pluginAssets[pluginType][lib]) {
                pluginAssets[pluginType][lib]![path] = await glob[path]()
              }
            } catch (error) {
              console.error(`Failed to load ${pluginType} file at ${path} for ${libKey}:`, error)
            }
          }
        }
      }

      for (const type of Object.keys(PLUGIN_TYPE_CONFIGS) as PluginType[]) {
        const modulesAssets = pluginAssets[type][PluginLib.modules]
        if (!modulesAssets) continue

        for (const [path, manifest] of Object.entries(modulesAssets)) {
          processPluginManifest(path, manifest, type)
        }

        pluginCollections[type].available.value.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      }

      pluginsLoaded.value = true
    } catch (error) {
      console.error('Error loading plugins:', error)
    }
  }

  onMounted(async () => {
    await loadPlugins()
  })

  /**
   * Find a plugin by ID regardless of type
   * @param id The plugin ID
   * @returns The plugin manifest or undefined if not found
   */
  const findPluginById = (id: string): PluginManifest | undefined => {
    const extension = availableExtensions.value.find((e) => e.id === id)
    if (extension) return extension

    return availableScripts.value.find((s) => s.id === id)
  }

  /**
   * Get plugin description content
   * @param pluginId The plugin ID
   * @returns The description content or empty string if not found
   */
  const getPluginDescription = (pluginId: string): string => {
    return pluginDescriptionContent.value[pluginId] || ''
  }

  return {
    // State
    pluginsLoaded,
    availableExtensions,
    availableScripts,
    availablePlugins,
    availableExtensionIds,
    availableScriptIds,

    // Content getters
    getPluginAssetUrl,
    getScriptContent,
    getPluginDescription,
    pluginDescriptionContent,

    // Utilities
    findPluginById,
    loadPlugins,

    // Plugin types for external use
    pluginTypes: PluginType,
  }
})
