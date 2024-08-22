import type { ExtensionsEvents } from '#imports'

const extensionsState = createGlobalState(() => {
  const baseExtensions = ref<Record<string, any>>({})

  // Egg
  const extensionsEgg = ref(false)

  const extensionsEggCounter = ref(0)

  return { baseExtensions, extensionsEgg, extensionsEggCounter }
})

export interface ExtensionManifest {
  id: string
  title: string
  subTitle: string
  description: string
  entry: string
  version: string
  iconUrl: string
  publisherName: string
  publisherEmail: string
  publisherUrl: string
  disabled?: boolean
  config?: {
    modalMaxWith?: 'xs' | 'sm' | 'md' | 'lg'
    contentMinHeight?: string
  }
}

abstract class ExtensionType {
  abstract id: string
  abstract uiKey: number
  abstract baseId: string
  abstract fkUserId: string
  abstract extensionId: string
  abstract title: string
  abstract kvStore: any
  abstract meta: any
  abstract order: number
  abstract setTitle(title: string): Promise<any>
  abstract setMeta(key: string, value: any): Promise<any>
  abstract clear(): Promise<any>
  abstract delete(): Promise<any>
  abstract serialize(): any
  abstract deserialize(data: any): void
}

export { ExtensionType }

export const useExtensions = createSharedComposable(() => {
  const { baseExtensions, extensionsEgg, extensionsEggCounter } = extensionsState()

  const { $api } = useNuxtApp()

  const { base } = storeToRefs(useBase())

  const eventBus = useEventBus<ExtensionsEvents>(Symbol('useExtensions'))

  const extensionsLoaded = ref(false)

  const availableExtensions = ref<ExtensionManifest[]>([])

  // Object to store description content for each extension
  const descriptionContent = ref<Record<string, string>>({})

  const extensionPanelSize = ref(40)

  const activeBaseExtensions = computed(() => {
    if (!base.value || !base.value.id) {
      return null
    }
    return baseExtensions.value[base.value.id]
  })

  const isPanelExpanded = computed(() => {
    return activeBaseExtensions.value ? activeBaseExtensions.value.expanded : false
  })

  const extensionList = computed<ExtensionType[]>(() => {
    return (activeBaseExtensions.value ? activeBaseExtensions.value.extensions : []).sort(
      (a: ExtensionType, b: ExtensionType) => {
        return (a?.order ?? Infinity) - (b?.order ?? Infinity)
      },
    )
  })

  const toggleExtensionPanel = () => {
    if (activeBaseExtensions.value) {
      activeBaseExtensions.value.expanded = !activeBaseExtensions.value.expanded
    }
  }

  const addExtension = async (extension: any) => {
    if (!base.value || !base.value.id || !baseExtensions.value[base.value.id]) {
      return
    }

    const extensionReq = {
      base_id: base.value.id,
      title: extension.title,
      extension_id: extension.id,
      meta: {
        collapsed: false,
      },
    }

    const newExtension = await $api.extensions.create(base.value.id, extensionReq)

    if (newExtension) {
      baseExtensions.value[base.value.id].extensions.push(new Extension(newExtension))
    }

    return newExtension
  }

  const updateExtension = async (extensionId: string, extension: any) => {
    if (!base.value || !base.value.id || !baseExtensions.value[base.value.id]) {
      return
    }

    const updatedExtension = await $api.extensions.update(extensionId, extension)

    if (updatedExtension) {
      const extension = baseExtensions.value[base.value.id].extensions.find((ext: any) => ext.id === extensionId)

      if (extension) {
        extension.deserialize(updatedExtension)
      }
    }

    return updatedExtension
  }

  const updateExtensionMeta = async (extensionId: string, key: string, value: any) => {
    const extension = extensionList.value.find((ext: any) => ext.id === extensionId)

    if (!extension) {
      return
    }

    return updateExtension(extensionId, {
      meta: {
        ...extension.meta,
        [key]: value,
      },
    })
  }

  const deleteExtension = async (extensionId: string) => {
    if (!base.value || !base.value.id || !baseExtensions.value[base.value.id]) {
      return
    }

    await $api.extensions.delete(extensionId)

    baseExtensions.value[base.value.id].extensions = baseExtensions.value[base.value.id].extensions.filter(
      (ext: any) => ext.id !== extensionId,
    )
  }

  const duplicateExtension = async (extensionId: string) => {
    if (!base.value || !base.value.id || !baseExtensions.value[base.value.id]) {
      return
    }

    const extension = extensionList.value.find((ext: any) => ext.id === extensionId)

    if (!extension) {
      return
    }

    const { id: _id, order: _order, ...extensionData } = extension.serialize()

    const newExtension = await $api.extensions.create(base.value.id, {
      ...extensionData,
      title: `${extension.title} (Copy)`,
    })

    if (newExtension) {
      baseExtensions.value[base.value.id].extensions.push(new Extension(newExtension))
    }

    return newExtension
  }

  const clearKvStore = async (extensionId: string) => {
    const extension = extensionList.value.find((ext: any) => ext.id === extensionId)

    if (!extension) {
      return
    }

    return updateExtension(extensionId, {
      kv_store: {},
    })
  }

  const loadExtensionsForBase = async (baseId: string) => {
    if (!baseId) {
      return
    }

    try {
      const { list } = await $api.extensions.list(baseId)

      const extensions = list?.map((ext: any) => new Extension(ext))

      if (baseExtensions.value[baseId]) {
        baseExtensions.value[baseId].extensions = extensions || baseExtensions.value[baseId].extensions
      } else {
        baseExtensions.value[baseId] = {
          extensions: extensions || [],
          expanded: false,
        }
      }
    } catch (e) {
      console.log(e)
    }
  }

  const getExtensionAssetsUrl = (pathOrUrl: string) => {
    if (pathOrUrl.startsWith('http')) {
      return pathOrUrl
    } else {
      return new URL(`../extensions/${pathOrUrl}`, import.meta.url).href
    }
  }

  class KvStore {
    private _id: string
    private data: Record<string, any>

    constructor(id: string, data: any) {
      this._id = id
      this.data = data || {}
    }

    get(key: string) {
      return this.data[key] || null
    }

    set(key: string, value: any) {
      this.data[key] = value
      return updateExtension(this._id, { kv_store: this.data })
    }

    delete(key: string) {
      delete this.data[key]
      return updateExtension(this._id, { kv_store: this.data })
    }

    serialize() {
      return this.data
    }
  }

  class Extension implements ExtensionType {
    private _id: string
    private _baseId: string
    private _fkUserId: string
    private _extensionId: string
    private _title: string
    private _kvStore: KvStore
    private _meta: any
    private _order: number

    public uiKey = 0

    constructor(data: any) {
      this._id = data.id
      this._baseId = data.base_id
      this._fkUserId = data.fk_user_id
      this._extensionId = data.extension_id
      this._title = data.title
      this._kvStore = new KvStore(this._id, data.kv_store)
      this._meta = data.meta
      this._order = data.order
    }

    get id() {
      return this._id
    }

    get baseId() {
      return this._baseId
    }

    get fkUserId() {
      return this._fkUserId
    }

    get extensionId() {
      return this._extensionId
    }

    get title() {
      return this._title
    }

    get kvStore() {
      return this._kvStore
    }

    get meta() {
      return this._meta
    }

    get order() {
      return this._order
    }

    serialize() {
      return {
        id: this._id,
        base_id: this._baseId,
        fk_user_id: this._fkUserId,
        extension_id: this._extensionId,
        title: this._title,
        kv_store: this._kvStore.serialize(),
        meta: this._meta,
        order: this._order,
      }
    }

    deserialize(data: any) {
      this._id = data.id
      this._baseId = data.base_id
      this._fkUserId = data.fk_user_id
      this._extensionId = data.extension_id
      this._title = data.title
      this._kvStore = new KvStore(this._id, data.kv_store)
      this._meta = data.meta
      this._order = data.order
    }

    setTitle(title: string): Promise<any> {
      return updateExtension(this.id, { title })
    }

    setMeta(key: string, value: any): Promise<any> {
      return updateExtensionMeta(this.id, key, value)
    }

    clear(): Promise<any> {
      return clearKvStore(this.id).then(() => {
        this.uiKey++
      })
    }

    delete(): Promise<any> {
      return deleteExtension(this.id)
    }
  }

  // Function to load extensions
  onMounted(async () => {
    try {
      // Load all JSON modules from the specified glob pattern
      const modules = import.meta.glob('../extensions/*/*.json')

      const markdownModules = import.meta.glob('../extensions/*/*.md', {
        query: '?raw',
        import: 'default',
      })

      const extensionCount = Object.keys(modules).length
      let disabledCount = 0

      // Array to hold the promises
      const promises = Object.keys(modules).map(async (path) => {
        try {
          // Load the module
          const mod = (await modules[path]()) as any
          const manifest = mod.default as ExtensionManifest

          if (manifest?.disabled !== true) {
            availableExtensions.value.push(manifest)

            // Load the descriptionMarkdown if available
            if (manifest.description) {
              const markdownPath = `../extensions/${manifest.description}`

              if (markdownModules[markdownPath] && manifest?.id) {
                try {
                  const markdownContent = await markdownModules[markdownPath]()

                  descriptionContent.value[manifest.id] = `${markdownContent}`
                } catch (markdownError) {
                  console.error(`Failed to load Markdown file at ${markdownPath}:`, markdownError)
                }
              }
            }
          } else {
            disabledCount++
          }
        } catch (error) {
          console.error(`Failed to load module at ${path}:`, error)
        }
      })

      // Wait for all modules to be processed
      await Promise.all(promises)

      if (availableExtensions.value.length + disabledCount === extensionCount) {
        // Sort extensions
        availableExtensions.value.sort((a, b) => a.title.localeCompare(b.title))
        extensionsLoaded.value = true
      }
    } catch (error) {
      console.error('Error loading extensions:', error)
    }

    if (isEeUI) {
      extensionsEgg.value = true
    }
  })

  watch(
    () => base.value?.id,
    (baseId) => {
      if (baseId && !baseExtensions.value[baseId]) {
        loadExtensionsForBase(baseId).catch((e) => {
          console.error(e)
        })
      }
    },
    {
      immediate: true,
    },
  )

  // Extension details modal
  const isDetailsVisible = ref(false)
  const detailsExtensionId = ref<string>()
  const detailsFrom = ref<'market' | 'extension'>('market')

  const showExtensionDetails = (extensionId: string, from?: 'market' | 'extension') => {
    detailsExtensionId.value = extensionId
    isDetailsVisible.value = true
    detailsFrom.value = from || 'market'
  }

  // Extension market modal
  const isMarketVisible = ref(false)

  const onEggClick = () => {
    extensionsEggCounter.value++
    if (extensionsEggCounter.value >= 2) {
      extensionsEgg.value = true
    }
  }

  return {
    extensionsLoaded,
    availableExtensions,
    descriptionContent,
    extensionList,
    isPanelExpanded,
    toggleExtensionPanel,
    addExtension,
    duplicateExtension,
    updateExtension,
    updateExtensionMeta,
    clearKvStore,
    deleteExtension,
    getExtensionAssetsUrl,
    isDetailsVisible,
    detailsExtensionId,
    detailsFrom,
    showExtensionDetails,
    isMarketVisible,
    onEggClick,
    extensionsEgg,
    extensionPanelSize,
    eventBus,
  }
})
