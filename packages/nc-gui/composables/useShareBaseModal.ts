import type { StringOrNullType } from 'nocodb-sdk'

interface ShareBase {
  uuid?: string
  url?: string
  role?: string
  fk_custom_url_id?: StringOrNullType
}

export enum ShareBaseRole {
  Editor = 'editor',
  Viewer = 'viewer',
}

export type ShareBaseModalScreen = 'main' | 'link-settings' | 'regenerate-confirm' | 'disable-confirm'

const [useProvideShareBaseModal, useShareBaseModal] = useInjectionState(() => {
  const { dashboardUrl } = useDashboard()
  const { $api, $e } = useNuxtApp()
  const { copy } = useCopy()
  const { appInfo } = useGlobal()
  const { base, isPrivateBase } = storeToRefs(useBase())
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const screen = ref<ShareBaseModalScreen>('main')
  const direction = ref<'forward' | 'backward'>('forward')

  // disable-confirm can be reached from the main toggle or the link-settings
  // "Disable link" button — remember where to return on cancel.
  const disableConfirmReturn = ref<ShareBaseModalScreen>('link-settings')

  function goTo(target: ShareBaseModalScreen) {
    direction.value = 'forward'
    screen.value = target
  }

  function goBack() {
    direction.value = 'backward'
    if (screen.value === 'disable-confirm') {
      screen.value = disableConfirmReturn.value
    } else if (screen.value === 'regenerate-confirm') {
      screen.value = 'link-settings'
    } else {
      screen.value = 'main'
    }
  }

  function confirmDisableLink(returnTo: ShareBaseModalScreen = 'link-settings') {
    // Callers guard on isPrivateBase before reaching here.
    disableConfirmReturn.value = returnTo
    goTo('disable-confirm')
  }

  const sharedBase = ref<null | ShareBase>(null)
  const isToggleBaseLoading = ref(false)
  const isRoleToggleLoading = ref(false)
  const isRegeneratingLink = ref(false)
  const isCustomUrlSaving = ref(false)

  const url = computed(() => {
    if (!sharedBase.value || !sharedBase.value.uuid) return ''
    return encodeURI(`${dashboardUrl.value}/base/${sharedBase.value.uuid}`)
  })

  const isSharedBaseEnabled = computed(() => {
    if (isPrivateBase.value) return false
    return !!sharedBase.value?.uuid
  })

  const loadBase = async () => {
    try {
      if (!base.value.id) return
      const res = await $api.base.sharedBaseGet(base.value.id)
      sharedBase.value = {
        uuid: res.uuid,
        url: res.url,
        role: res.roles,
        fk_custom_url_id: res?.fk_custom_url_id || null,
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const createShareBase = async (role = ShareBaseRole.Viewer, custUrl = undefined) => {
    const isCustomUrlUpdate = custUrl !== undefined
    if (isCustomUrlUpdate) isCustomUrlSaving.value = true
    try {
      if (!base.value.id) return
      const res = await $api.base.sharedBaseUpdate(base.value.id, {
        roles: role,
        original_url: url.value,
        ...(isCustomUrlUpdate ? { custom_url_path: custUrl ?? null } : {}),
      })

      sharedBase.value = res ?? {}
      sharedBase.value!.role = role
      base.value.uuid = res.uuid

      if (isCustomUrlUpdate) {
        sharedBase.value!.fk_custom_url_id = res.fk_custom_url_id
        base.value.fk_custom_url_id = res.fk_custom_url_id
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      if (isCustomUrlUpdate) isCustomUrlSaving.value = false
    }

    $e('a:shared-base:enable', { role })
  }

  const disableSharedBase = async () => {
    try {
      if (!base.value.id) return
      await $api.base.sharedBaseDisable(base.value.id)
      sharedBase.value = null
      base.value.uuid = undefined
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }

    $e('a:shared-base:disable')
  }

  const toggleSharedBase = async () => {
    if (isToggleBaseLoading.value) return
    isToggleBaseLoading.value = true
    try {
      if (isSharedBaseEnabled.value) {
        await disableSharedBase()
      } else {
        await createShareBase()
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isToggleBaseLoading.value = false
    }
  }

  const onRoleToggle = async () => {
    if (!sharedBase.value) return
    if (isRoleToggleLoading.value) return
    isRoleToggleLoading.value = true
    try {
      await createShareBase(sharedBase.value.role === ShareBaseRole.Editor ? ShareBaseRole.Viewer : ShareBaseRole.Editor)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isRoleToggleLoading.value = false
    }
  }

  const copyCustomUrl = async (custUrl = '') => {
    return await copy(`${appInfo.value.ncSiteUrl}/p/${encodeURIComponent(custUrl)}`)
  }

  const disableLink = async () => {
    if (isToggleBaseLoading.value) return
    isToggleBaseLoading.value = true
    try {
      await disableSharedBase()
      // After disable the link-settings screen no longer applies — return to main.
      direction.value = 'backward'
      screen.value = 'main'
    } finally {
      isToggleBaseLoading.value = false
    }
  }

  /**
   * Regenerate the base share UUID via the dedicated backend operation. Role,
   * password, and any linked custom URL are preserved server-side.
   */
  const regenerateLink = async () => {
    if (!sharedBase.value?.uuid || !base.value?.id) return false
    if (isRegeneratingLink.value) return false
    const workspaceId = base.value.fk_workspace_id || activeWorkspaceId.value
    if (!workspaceId) return false

    isRegeneratingLink.value = true
    try {
      const res = await $api.internal.postOperation(
        workspaceId,
        base.value.id,
        {
          operation: 'shareBaseRegenerate',
          baseId: base.value.id,
        },
        {},
      )
      const newUuid = (res as any)?.uuid
      if (newUuid) {
        sharedBase.value = {
          ...sharedBase.value,
          uuid: newUuid,
          url: (res as any)?.url,
        }
        base.value.uuid = newUuid
      }
      $e('a:shared-base:regenerate')
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    } finally {
      isRegeneratingLink.value = false
    }
  }

  return {
    screen,
    direction,
    goTo,
    goBack,
    sharedBase,
    isToggleBaseLoading,
    isRoleToggleLoading,
    isRegeneratingLink,
    isCustomUrlSaving,
    url,
    isSharedBaseEnabled,
    isPrivateBase,
    loadBase,
    createShareBase,
    toggleSharedBase,
    onRoleToggle,
    copyCustomUrl,
    confirmDisableLink,
    disableLink,
    regenerateLink,
  }
})

export { useProvideShareBaseModal, useShareBaseModal }
