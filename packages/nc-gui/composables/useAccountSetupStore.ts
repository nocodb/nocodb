import type { PluginTestReqType, PluginType } from 'nocodb-sdk'

export enum Action {
  Save = 'save',
  Test = 'test',
}

const [useProvideAccountSetupStore, useAccountSetupStore] = createInjectionState(() => {
  const apps = ref<(PluginType & { parsedInput?: Record<string, any>; tags?: string[] })[]>([])

  const { $api, $e } = useNuxtApp()

  const { t } = useI18n()

  const activePlugin = ref<PluginType | null>(null)
  const activePluginFormData = ref({})
  const isLoading = ref(false)
  const loadingAction = ref<null | Action>(null)
  const showPluginUninstallModal = ref(false)

  const emailApps = computed(() => apps.value.filter((app) => app.category === 'Email'))
  const storageApps = computed(() => apps.value.filter((app) => app.category === 'Storage'))

  const emailConfigured = computed(() => emailApps.value.find((app) => app.active))
  const storageConfigured = computed(() => storageApps.value.find((app) => app.active))

  const listModalDlg = ref(false)
  const configModalDlg = ref(false)

  const categorizeApps = computed(() => {
    return apps.value.reduce((acc, app) => {
      const key = app.category.toLowerCase()
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(app)
      return acc
    }, {} as Record<string, PluginType[]>)
  })

  const loadSetupApps = async () => {
    try {
      const plugins = (await $api.plugin.list()).list ?? []

      apps.value = plugins.map((p) => ({
        ...p,
        tags: p.tags ? p.tags.split(',') : [],
        parsedInput: p.input && JSON.parse(p.input as string),
      })) as any[]
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveSettings = async () => {
    loadingAction.value = Action.Save

    try {
      await $api.plugin.update(activePlugin.value?.id, {
        input: JSON.stringify(activePluginFormData.value),
        active: true,
      })

      // Plugin settings saved successfully
      message.success(activePlugin.value?.formDetails.msgOnInstall || t('msg.success.pluginSettingsSaved'))
      // load all apps again to update the pending status
      loadSetupApps().catch(console.error)
      navigateTo('/account/setup')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      loadingAction.value = null
    }
  }

  const testSettings = async () => {
    loadingAction.value = Action.Test

    try {
      if (activePlugin.value) {
        const res = await $api.plugin.test({
          input: JSON.stringify(activePluginFormData.value),
          title: activePlugin.value.title,
          category: activePlugin.value.category,
        } as PluginTestReqType)

        if (res) {
          // Successfully tested plugin settings
          message.success(t('msg.success.pluginTested'))
        } else {
          // Invalid credentials
          message.info(t('msg.info.invalidCredentials'))
        }
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      loadingAction.value = null
    }
  }

  const readPluginDetails = async (id: string) => {
    try {
      isLoading.value = true

      const res = await $api.plugin.read(id)
      const formDetails = JSON.parse(res.input_schema ?? '{}')
      const emptyParsedInput = formDetails.array ? [{}] : {}
      const parsedInput = typeof res.input === 'string' ? JSON.parse(res.input) : emptyParsedInput

      // the type of 'secure' was XcType.SingleLineText in 0.0.1
      // and it has been changed to XcType.Checkbox, since 0.0.2
      // hence, change the text value to boolean here
      if ('secure' in parsedInput && typeof parsedInput.secure === 'string') {
        parsedInput.secure = parsedInput.secure === 'true'
      }

      activePlugin.value = { ...res, formDetails, parsedInput }
      activePluginFormData.value = activePlugin.value.parsedInput
    } catch (e) {
      console.log(e)
    } finally {
      isLoading.value = false
    }
  }

  const resetPlugin = async () => {
    try {
      await $api.plugin.update(activePlugin.value.id, {
        input: null,
        active: false,
      })
      // Plugin uninstalled successfully
      message.success(t('msg.success.pluginUninstalled'))
      showPluginUninstallModal.value = false
      await loadSetupApps()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }

    $e('a:appstore:reset', { app: activePlugin.value.title })
  }

  return {
    apps,
    emailApps,
    storageApps,
    loadSetupApps,
    categorizeApps,
    activePlugin,
    readPluginDetails,
    activePluginFormData,
    isLoading,
    testSettings,
    saveSettings,
    loadingAction,
    emailConfigured,
    storageConfigured,
    listModalDlg,
    configModalDlg,
    showPluginUninstallModal,
    resetPlugin,
  }
})

export { useProvideAccountSetupStore }

export function useAccountSetupStoreOrThrow() {
  const columnCreateStore = useAccountSetupStore()

  if (columnCreateStore == null) throw new Error('Please call `useProvideAccountSetupStore` on the appropriate parent component')

  return columnCreateStore
}
