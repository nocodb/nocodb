<script setup lang="ts">
import { extractSdkResponseErrorMsg, message, onMounted, storeToRefs, useDashboard, useNuxtApp, useProject } from '#imports'

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

const base = ref<null | ShareBase>(null)

const { project } = storeToRefs(useProject())

const url = computed(() => (base.value && base.value.uuid ? `${dashboardUrl.value}#/base/${base.value.uuid}` : ''))

const loadBase = async () => {
  try {
    if (!project.value.id) return

    const res = await $api.project.sharedBaseGet(project.value.id)

    base.value = {
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
    if (!project.value.id) return

    const res = await $api.project.sharedBaseUpdate(project.value.id, {
      roles: role,
    })

    base.value = res ?? {}
    base.value!.role = role
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:enable', { role })
}

const disableSharedBase = async () => {
  try {
    if (!project.value.id) return

    await $api.project.sharedBaseDisable(project.value.id)
    base.value = null
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:disable')
}

onMounted(() => {
  if (!base.value) {
    loadBase()
  }
})

const isSharedBaseEnabled = computed(() => !!base.value?.uuid)
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
  if (!base.value) return
  if (isRoleToggleLoading.value) return

  isRoleToggleLoading.value = true
  try {
    if (base.value.role === ShareBaseRole.Viewer) {
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
        <div class="text-black font-medium">Enable Public Access</div>
        <a-switch :checked="isSharedBaseEnabled" :loading="isToggleBaseLoading" class="ml-2" @click="toggleSharedBase" />
      </div>
      <div v-if="isSharedBaseEnabled" class="flex flex-col w-full mt-3 border-t-1 pt-3 border-gray-100">
        <GeneralCopyUrl v-model:url="url" />
        <div class="flex flex-row justify-between mt-3 bg-gray-50 px-3 py-2 rounded-md">
          <div class="text-black">Editing access</div>
          <a-switch
            :loading="isRoleToggleLoading"
            :checked="base?.role === ShareBaseRole.Editor"
            class="ml-2"
            @click="onRoleToggle"
          />
        </div>
      </div>
    </div>
  </div>
</template>
