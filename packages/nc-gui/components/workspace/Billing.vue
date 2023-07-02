<script lang="ts" setup>
import { extractSdkResponseErrorMsg } from '~/utils'

const workspaceStore = useWorkspace()
const { upgradeActiveWorkspace } = workspaceStore
const isUpgrading = ref(false)

const upgradeWorkspace = async () => {
  isUpgrading.value = true
  try {
    await upgradeActiveWorkspace()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpgrading.value = false
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center">
    <div class="mt-20 px-8 py-6 flex flex-col justify-center items-center gap-y-8 border-1 border-gray-100 rounded-md">
      <div class="flex text-xl font-medium">Upgrade your workspace</div>

      <a-button type="primary" size="large" class="!rounded-md" :loading="isUpgrading" @click="upgradeWorkspace"
        >Upgrade</a-button
      >
    </div>
  </div>
</template>
