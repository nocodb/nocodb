<script lang="ts" setup>
import { WorkspacePlan } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import { extractSdkResponseErrorMsg } from '#imports'

const workspaceStore = useWorkspace()
const { upgradeActiveWorkspace } = workspaceStore
const { activeWorkspace } = storeToRefs(workspaceStore)
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
      <template v-if="activeWorkspace.plan === WorkspacePlan.FREE">
        <div class="flex text-xl font-medium">Upgrade your workspace</div>

        <a-button
          v-e="['c:workspace:settings:upgrade']"
          type="primary"
          size="large"
          class="!rounded-md"
          :loading="isUpgrading"
          @click="upgradeWorkspace"
          >Upgrade
        </a-button>
      </template>
      <template v-else>
        <div class="flex text-xl font-medium">Your workspace is upgraded</div>
      </template>
    </div>
  </div>
</template>
