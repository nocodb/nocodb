const extensionsState = createGlobalState(() => {
  const baseExtensions = ref<Record<string, any>>({})
  return { baseExtensions }
})

interface ExtensionManifest {
  id: string
  title: string
  description: string
  entry: string
  version: string
  iconUrl: string
  publisherName: string
  publisherEmail: string
  publisherUrl: string
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
  abstract setTitle(title: string): Promise<any>
  abstract setMeta(key: string, value: any): Promise<any>
  abstract clear(): Promise<any>
  abstract delete(): Promise<any>
  abstract serialize(): any
  abstract deserialize(data: any): void
}

export { ExtensionType }

export const useExtensions = createSharedComposable(() => {
  const { baseExtensions } = extensionsState()

  const { $api } = useNuxtApp()

  const { base } = storeToRefs(useBase())

  const extensionsLoaded = ref(false)

  const availableExtensions = ref<ExtensionManifest[]>([])

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
    return activeBaseExtensions.value ? activeBaseExtensions.value.extensions : []
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

    const { id: _id, ...extensionData } = extension.serialize()

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
  }

  const getExtensionIcon = (pathOrUrl: string) => {
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

    public uiKey = 0

    constructor(data: any) {
      this._id = data.id
      this._baseId = data.base_id
      this._fkUserId = data.fk_user_id
      this._extensionId = data.extension_id
      this._title = data.title
      this._kvStore = new KvStore(this._id, data.kv_store)
      this._meta = data.meta
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

    serialize() {
      return {
        id: this._id,
        base_id: this._baseId,
        fk_user_id: this._fkUserId,
        extension_id: this._extensionId,
        title: this._title,
        kv_store: this._kvStore.serialize(),
        meta: this._meta,
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

  onMounted(() => {
    const modules = import.meta.glob('../extensions/*/*.json')
    for (const path in modules) {
      modules[path]().then((mod: any) => {
        const manifest = mod.default as ExtensionManifest
        availableExtensions.value.push(manifest)
        if (Object.keys(modules).length === availableExtensions.value.length) {
          extensionsLoaded.value = true
        }
      })
    }

    until(base)
      .toMatch((v) => !!v)
      .then(() => {
        if (!base.value || !base.value.id) {
          return
        }

        if (!baseExtensions.value[base.value.id]) {
          loadExtensionsForBase(base.value.id)
        }
      })
  })

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

  // Egg
  const extensionsEgg = ref(false)

  const extensionsEggCounter = ref(0)

  const onEggClick = () => {
    extensionsEggCounter.value++
    if (extensionsEggCounter.value >= 2) {
      extensionsEgg.value = true
    }
  }

  return {
    extensionsLoaded,
    availableExtensions,
    extensionList,
    isPanelExpanded,
    toggleExtensionPanel,
    addExtension,
    duplicateExtension,
    updateExtension,
    updateExtensionMeta,
    clearKvStore,
    deleteExtension,
    getExtensionIcon,
    isDetailsVisible,
    detailsExtensionId,
    detailsFrom,
    showExtensionDetails,
    isMarketVisible,
    onEggClick,
    extensionsEgg,
    extensionPanelSize,
  }
})
