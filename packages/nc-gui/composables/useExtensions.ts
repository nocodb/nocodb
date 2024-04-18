const extensionsState = createGlobalState(() => {
  const baseExtensions = ref<Record<string, any>>({})
  return { baseExtensions }
})

export const useExtensions = () => {
  const { baseExtensions } = extensionsState()

  const { base } = storeToRefs(useBase())

  const activeBaseExtensions = computed(() => {
    if (!base.value || !base.value.id) {
      return null
    }
    return baseExtensions.value[base.value.id]
  })

  const isPanelExpanded = computed(() => {
    return activeBaseExtensions.value ? activeBaseExtensions.value.expanded : false
  })

  const extensionList = computed(() => {
    return activeBaseExtensions.value ? activeBaseExtensions.value.extensions : []
  })

  const toggleExtensionPanel = () => {
    if (activeBaseExtensions.value) {
      activeBaseExtensions.value.expanded = !activeBaseExtensions.value.expanded
    }
  }

  const addExtension = async (extension: any) => {
    if (!base.value || !base.value.id) {
      return
    }

    if (!baseExtensions.value[base.value.id]) {
      baseExtensions.value[base.value.id] = {
        extensions: [],
        expanded: true,
      }
    }

    baseExtensions.value[base.value.id].extensions.push(extension)
  }

  const loadExtensionsForBase = async (baseId: string) => {
    if (!baseId) {
      return
    }

    const extensions = null // fetchExtensionsForBase(baseId)

    if (baseExtensions.value[baseId]) {
      baseExtensions.value[baseId].extensions = extensions || baseExtensions.value[baseId].extensions
    } else {
      baseExtensions.value[baseId] = {
        extensions: extensions || [],
        expanded: true,
      }
    }
  }

  onMounted(() => {
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

  watch(base, (v) => {
    if (v && v.id) {
      loadExtensionsForBase(v.id)
    }
  })

  return {
    extensionList,
    isPanelExpanded,
    toggleExtensionPanel,
    addExtension,
  }
}
