<script setup lang="ts">
import type { StringOrNullType } from 'nocodb-sdk'

interface ShareBase {
  uuid?: string
  url?: string
  role?: string
  fk_custom_url_id?: StringOrNullType
}

enum ShareBaseRole {
  Editor = 'editor',
  Viewer = 'viewer',
}

const { dashboardUrl } = useDashboard()

const { $api, $e } = useNuxtApp()

const { copy } = useCopy()

const sharedBase = ref<null | ShareBase>(null)

const { base } = storeToRefs(useBase())

const { appInfo } = useGlobal()

const url = computed(() => {
  if (!sharedBase.value || !sharedBase.value.uuid) return ''

  return encodeURI(`${dashboardUrl.value}#/base/${sharedBase.value.uuid}`)
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
  try {
    if (!base.value.id) return

    const res = await $api.base.sharedBaseUpdate(base.value.id, {
      roles: role,
      original_url: url.value,
      ...(custUrl !== undefined ? { custom_url_path: custUrl ?? null } : {}),
    })

    sharedBase.value = res ?? {}
    sharedBase.value!.role = role

    base.value.uuid = res.uuid

    if (custUrl !== undefined) {
      sharedBase.value!.fk_custom_url_id = res.fk_custom_url_id
      base.value.fk_custom_url_id = res.fk_custom_url_id
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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

onMounted(() => {
  if (!sharedBase.value) {
    loadBase()
  }
})

const isSharedBaseEnabled = computed(() => !!sharedBase.value?.uuid)
const isToggleBaseLoading = ref(false)
const isRoleToggleLoading = ref(false)

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
    await createShareBase(ShareBaseRole.Viewer)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isRoleToggleLoading.value = false
  }
}

const copyCustomUrl = async (custUrl = '') => {
  return await copy(`${appInfo.value.ncSiteUrl}/p/${encodeURIComponent(custUrl)}`)
}
</script>

<template>
  <div class="flex flex-col py-2 px-3 gap-2 w-full" data-testid="nc-share-base-sub-modal">
    <div class="flex flex-col w-full p-3 border-1 border-gray-100 rounded-md">
      <div class="flex flex-row w-full justify-between">
        <div class="text-gray-900 font-medium">{{ $t('activity.enablePublicAccess') }}</div>
        <a-switch
          v-e="['c:share:base:enable:toggle']"
          :checked="isSharedBaseEnabled"
          :loading="isToggleBaseLoading"
          class="ml-2"
          @click="toggleSharedBase"
        />
      </div>
      <div v-if="isSharedBaseEnabled" class="flex flex-col gap-3 w-full mt-3 border-t-1 pt-3 border-gray-100">
        <GeneralCopyUrl v-model:url="url" />
        <DlgShareAndCollaborateCustomUrl
          v-if="sharedBase?.uuid"
          :id="sharedBase.fk_custom_url_id"
          :backend-url="appInfo.ncSiteUrl"
          :copy-custom-url="copyCustomUrl"
          @update-custom-url="createShareBase(undefined, $event)"
        />
        <div
          v-if="!appInfo.ee && sharedBase?.role === ShareBaseRole.Editor"
          class="flex flex-row justify-between bg-gray-50 px-3 py-2 rounded-md"
        >
          <div class="text-black">{{ $t('activity.editingAccess') }}</div>
          <a-switch
            v-e="['c:share:base:role:toggle']"
            :loading="isRoleToggleLoading"
            :checked="sharedBase?.role === ShareBaseRole.Editor"
            class="ml-2"
            @click="onRoleToggle"
          />
        </div>
      </div>
    </div>
  </div>
</template>
