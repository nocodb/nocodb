<script lang="ts" setup>
import { WorkspacePlan, WorkspaceStatus } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted } from '@vue/runtime-core'
import { extractSdkResponseErrorMsg } from '#imports'

const workspaceStore = useWorkspace()
const { upgradeActiveWorkspace, loadWorkspaces } = workspaceStore
const { activeWorkspace } = storeToRefs(workspaceStore)
const isUpgrading = ref(false)

const upgradeWorkspace = async () => {
  isUpgrading.value = true
  try {
    await upgradeActiveWorkspace()
    loadWorkspacesWithInterval()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpgrading.value = false
  }
}

let timerRef: any

onUnmounted(() => {
  if (timerRef) clearTimeout(timerRef)
})

// todo: do it in a better way
function loadWorkspacesWithInterval() {
  // keep checking for workspace status every 10 seconds if workspace is upgrading
  timerRef = setTimeout(async () => {
    if (
      activeWorkspace.value &&
      activeWorkspace.value.plan === WorkspacePlan.FREE &&
      activeWorkspace.value.status !== WorkspaceStatus.CREATED
    ) {
      await loadWorkspaces()
      loadWorkspacesWithInterval()
    }
  }, 10000)
}

onMounted(async () => {
  loadWorkspacesWithInterval()
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center">
    <div class="mt-20 px-8 py-6 flex flex-col justify-center items-center gap-y-8 border-1 border-gray-100 rounded-md">
      <template v-if="activeWorkspace.plan === WorkspacePlan.FREE">
        <div class="flex text-xl font-medium">Upgrade your workspace</div>

        <a-button type="primary" size="large" class="!rounded-md" :loading="isUpgrading" @click="upgradeWorkspace"
          >Upgrade
        </a-button>
      </template>
      <div
        v-else-if="activeWorkspace && activeWorkspace.status !== WorkspaceStatus.CREATED"
        class="h-full w-full flex flex-col gap-3 items-center justify-center"
      >
        <a-spin size="large" />
        <div class="text-gray-300 text-lg">Please wait while we set up your workspace</div>
      </div>
      <template v-else>
        <div class="flex text-xl font-medium">Your workspace is upgraded</div>
      </template>
    </div>
  </div>
</template>
