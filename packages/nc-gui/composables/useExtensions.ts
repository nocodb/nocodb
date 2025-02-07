import { useStorage } from '@vueuse/core'
import { ExtensionsEvents } from '#imports'

const extensionsState = createGlobalState(() => {
  const baseExtensions = ref<Record<string, any>>({})

  return { baseExtensions }
})

interface ExtensionPanelState {
  width: number
  isOpen: boolean
}
const extensionsPanelState = createGlobalState(() =>
  useStorage<Record<string, ExtensionPanelState>>('nc-extensions-global-state', {}),
)

export interface ExtensionManifest {
  id: string
  title: string
  subTitle: string
  description: string
  entry: string
  version: string
  iconUrl: string
  publisher: {
    name: string
    email: string
    url: string
    icon?: {
      src: string
      width?: number
      height?: number
    }
  }
  links: {
    title: string
    href: string
  }[]
  config: {
    modalSize?: 'xs' | 'sm' | 'md' | 'lg'
    contentMinHeight?: string
  }
  order: number
  disabled?: boolean
}

export interface IKvStore<T extends Record<string, any>> {
  get<K extends keyof T>(key: K): T[K] | null
  set<K extends keyof T>(key: K, value: T[K]): Promise<void>
  delete<K extends keyof T>(key: K): Promise<void>
  serialize(): Record<string, T[keyof T]>
}

abstract class ExtensionType {
  abstract id: string
  abstract uiKey: number
  abstract baseId: string
  abstract fkUserId: string
  abstract extensionId: string
  abstract title: string
  abstract kvStore: IKvStore<any>
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

enum ExtensionLib {
  assets = 'assets',
  modules = 'modules',
  markdowns = 'markdownModules',
}

export const useExtensions = createSharedComposable(() => {
  const globs = {
    [ExtensionLib.assets]: import.meta.glob('../extensions/*/assets/*', { query: '?url', import: 'default' }),
    [ExtensionLib.modules]: import.meta.glob('../extensions/*/*.json', { import: 'default' }),
    [ExtensionLib.markdowns]: import.meta.glob('../extensions/*/*.md', {
      query: '?raw',
      import: 'default',
    }),
  } as const

  const extensionAssets: {
    [ExtensionLib.assets]: Record<string, string>
    [ExtensionLib.modules]: Record<string, ExtensionManifest>
    [ExtensionLib.markdowns]: Record<string, string>
  } = {
    [ExtensionLib.assets]: {},
    [ExtensionLib.modules]: {},
    [ExtensionLib.markdowns]: {},
  }

  const { baseExtensions } = extensionsState()

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { base } = storeToRefs(useBase())

  const eventBus = useEventBus<ExtensionsEvents>(Symbol('useExtensions'))

  const extensionsLoaded = ref(false)

  const availableExtensions = ref<ExtensionManifest[]>([])

  const availableExtensionIds = computed(() => {
    return availableExtensions.value.map((e) => e.id)
  })

  // Object to store description content for each extension
  const descriptionContent = ref<Record<string, string>>({})

  const activeBaseExtensions = computed(() => {
    if (!base.value || !base.value.id) {
      return null
    }
    return baseExtensions.value[base.value.id]
  })

  const panelState = extensionsPanelState()

  const extensionPanelSize = ref(40)
  const isPanelExpanded = ref(false)

  const savePanelState = () => {
    panelState.value = {
      ...panelState.value,
      [base.value.id!]: {
        width: extensionPanelSize.value,
        isOpen: isPanelExpanded.value,
      },
    }
  }

  watch(
    base,
    () => {
      extensionPanelSize.value = +(panelState.value[base.value.id!]?.width || 40)
      isPanelExpanded.value = panelState.value[base.value.id!]?.isOpen || false
    },
    { immediate: true },
  )

  // Debounce since width is updated continuously when user drags.
  watchDebounced([extensionPanelSize, isPanelExpanded], savePanelState, { debounce: 500, maxWait: 1000 })

  const toggleExtensionPanel = () => {
    isPanelExpanded.value = !isPanelExpanded.value
  }

  const extensionList = computed<ExtensionType[]>(() => {
    return (activeBaseExtensions.value ? activeBaseExtensions.value.extensions : [])
      .filter((e: ExtensionType) => availableExtensionIds.value.includes(e.extensionId))
      .sort((a: ExtensionType, b: ExtensionType) => {
        return (a?.order ?? Infinity) - (b?.order ?? Infinity)
      })
  })

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

      nextTick(() => {
        eventBus.emit(ExtensionsEvents.ADD, newExtension?.id)
        $e('a:extension:add', { extensionId: extensionReq.extension_id })
      })
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

    const extensionToDelete = baseExtensions.value[base.value.id].extensions.find((e: any) => e.id === extensionId)

    baseExtensions.value[base.value.id].extensions = baseExtensions.value[base.value.id].extensions.filter(
      (ext: any) => ext.id !== extensionId,
    )

    $e('a:extension:delete', { extensionId: extensionToDelete.extensionId })
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
      const duplicatedExtension = new Extension(newExtension)
      baseExtensions.value[base.value.id].extensions.push(duplicatedExtension)
      eventBus.emit(ExtensionsEvents.DUPLICATE, duplicatedExtension.id)

      $e('a:extension:duplicate', { extensionId: extension.extensionId })
    }

    return newExtension
  }

  const clearKvStore = async (extensionId: string) => {
    const extension = extensionList.value.find((ext: any) => ext.id === extensionId)

    if (!extension) {
      return
    }

    let defaultKvStore = {}

    switch (extension.extensionId) {
      case 'nc-data-exporter': {
        defaultKvStore = {
          ...defaultKvStore,
          deletedExports: extension.kvStore.get('deletedExports') || [],
        }
      }
    }

    return updateExtension(extensionId, {
      kv_store: {
        ...defaultKvStore,
      },
    })
  }

  const loadExtensionsForBase = async (baseId: string) => {
    if (!baseId || !isUIAllowed('extensionList')) {
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
      const file = extensionAssets[ExtensionLib.assets][`../extensions/${pathOrUrl}`]

      return file || ''
    }
  }

  class KvStore<T extends Record<string, any> = any> implements IKvStore<T> {
    private _id: string
    private data: T

    constructor(id: string, data: T) {
      this._id = id
      this.data = data || {}
    }

    get<K extends keyof T = any>(key: K) {
      return this.data[key] || null
    }

    set<K extends keyof T = any>(key: K, value: any) {
      this.data[key] = value
      return updateExtension(this._id, { kv_store: this.data })
    }

    async delete<K extends keyof T = any>(key: K) {
      delete this.data[key]
      await updateExtension(this._id, { kv_store: this.data })
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

    async clear(): Promise<any> {
      return clearKvStore(this.id).then(() => {
        this.uiKey++

        nextTick(() => {
          eventBus.emit(ExtensionsEvents.CLEARDATA, this.id)
          $e('c:extension:clear-data', { extensionId: this._extensionId })
        })
      })
    }

    delete(): Promise<any> {
      return deleteExtension(this.id)
    }
  }

  // Function to load extensions
  onMounted(async () => {
    for (const [key, glob] of Object.entries(globs)) {
      for (const path of Object.keys(glob)) {
        if (!glob[path]) continue

        try {
          if (key in extensionAssets) {
            extensionAssets[key as ExtensionLib][path] = (await glob[path]()) as any
          }
        } catch (error) {
          console.error(`Failed to load file at ${path} for ${key}:`, error)
        }
      }
    }

    try {
      const extensionCount = Object.keys(extensionAssets[ExtensionLib.modules]).length
      let disabledCount = 0

      // Array to hold the promises

      for (const [path, manifest] of Object.entries(extensionAssets[ExtensionLib.modules])) {
        try {
          if (!Array.isArray(manifest.links)) {
            manifest.links = []
          }

          if (!manifest?.config || !manifest?.config?.modalSize) {
            manifest.config = {
              ...(manifest.config || {}),
              modalSize: 'lg',
            }
          }

          if (manifest?.disabled !== true) {
            availableExtensions.value.push(manifest)

            // Load the descriptionMarkdown if available
            if (manifest.description) {
              const markdownPath = `../extensions/${manifest.description}`

              if (extensionAssets[ExtensionLib.markdowns][markdownPath] && manifest?.id) {
                try {
                  const markdownContent = extensionAssets[ExtensionLib.markdowns][markdownPath]

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
      }

      if (availableExtensions.value.length + disabledCount === extensionCount) {
        // Sort extensions
        availableExtensions.value.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
        extensionsLoaded.value = true
      }
    } catch (error) {
      console.error('Error loading extensions:', error)
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

    $e('c:extension:details', { source: from, extensionId })
  }

  // Extension market modal
  const isMarketVisible = ref(false)

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
    extensionPanelSize,
    eventBus,
  }
})
