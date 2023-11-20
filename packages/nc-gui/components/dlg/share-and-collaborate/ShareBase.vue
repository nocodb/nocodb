<script setup lang="ts">
import {
  extractSdkResponseErrorMsg,
  message,
  onMounted,
  storeToRefs,
  useBase,
  useDashboard,
  useGlobal,
  useNuxtApp,
  useWorkspace,
} from '#imports'

interface ShareBase {
  uuid?: string
  url?: string
  role?: string
}

enum ShareBaseRole {
  Editor = 'editor',
  Viewer = 'viewer',
}

const { dashboardUrl } = useDashboard()

const { $api, $e } = useNuxtApp()

const sharedBase = ref<null | ShareBase>(null)

const { base } = storeToRefs(useBase())

const { getBaseUrl, appInfo } = useGlobal()

const workspaceStore = useWorkspace()

const url = computed(() => {
  if (!sharedBase.value || !sharedBase.value.uuid) return ''

  // get base url for workspace
  const baseUrl = getBaseUrl(workspaceStore.activeWorkspaceId)

  let dashboardUrl1 = dashboardUrl.value

  if (baseUrl) {
    dashboardUrl1 = `${baseUrl}${appInfo.value?.dashboardPath}`
  }
  return encodeURI(`${dashboardUrl1}#/base/${sharedBase.value.uuid}`)
})

const loadBase = async () => {
  try {
    if (!base.value.id) return

    const res = await $api.base.sharedBaseGet(base.value.id)

    sharedBase.value = {
      uuid: res.uuid,
      url: res.url,
      role: res.roles,
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const createShareBase = async (role = ShareBaseRole.Viewer) => {
  try {
    if (!base.value.id) return

    const res = await $api.base.sharedBaseUpdate(base.value.id, {
      roles: role,
    })

    sharedBase.value = res ?? {}
    sharedBase.value!.role = role

    base.value.uuid = res.uuid
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
    if (sharedBase.value.role === ShareBaseRole.Viewer) {
      await createShareBase(ShareBaseRole.Editor)
    } else {
      await createShareBase(ShareBaseRole.Viewer)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isRoleToggleLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col py-2 px-3 gap-2 w-full" data-testid="nc-share-base-sub-modal">
    <div class="flex flex-col w-full p-3 border-1 border-gray-100 rounded-md">
      <div class="flex flex-row w-full justify-between">
        <div class="text-black font-medium">{{ $t('activity.enablePublicAccess') }}</div>
        <a-switch
          v-e="['c:share:base:enable:toggle']"
          :checked="isSharedBaseEnabled"
          :loading="isToggleBaseLoading"
          class="ml-2"
          @click="toggleSharedBase"
        />
      </div>
      <div v-if="isSharedBaseEnabled" class="flex flex-col w-full mt-3 border-t-1 pt-3 border-gray-100">
        <GeneralCopyUrl v-model:url="url" />
        <div v-if="!appInfo.ee" class="flex flex-row justify-between mt-3 bg-gray-50 px-3 py-2 rounded-md">
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
