<script setup lang="ts">
const { $api } = useNuxtApp()

const baseStore = useBase()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { base, isSandbox, sandboxInfo } = storeToRefs(baseStore)

const { baseUrl } = baseStore

const basesStore = useBases()

const isOpenDropdown = ref<boolean>(false)

const isPublishDialogOpen = ref(false)
const isMerging = ref(false)
const publishStatus = ref<'pending' | 'loading' | 'success' | 'error'>('pending')
const publishErrorMessage = ref('')

/* const fetchSandboxDiff = async () => {
  if (!base.value?.id || !activeWorkspaceId.value) return
  isDiffLoading.value = true
  diffError.value = null
  try {
    const res = await $api.internal.getOperation(activeWorkspaceId.value, base.value.id, {
      operation: 'sandboxDiff',
    })
    diff.value = res?.data // fix: use .data, not .diff
  } catch (e: any) {
    diffError.value = await extractSdkResponseErrorMsg(e)
    diff.value = null
  } finally {
    isDiffLoading.value = false
  }
} */

const openPublishDialog = async () => {
  isOpenDropdown.value = false
  isPublishDialogOpen.value = true
  publishStatus.value = 'pending'
  publishErrorMessage.value = ''
  // await fetchSandboxDiff()
}

const goToMasterBase = async () => {
  if (!sandboxInfo.value?.master_base_id) return

  isOpenDropdown.value = false

  await navigateTo(
    baseUrl({
      id: sandboxInfo.value.master_base_id,
      type: 'database',
      isSharedBase: false,
    }),
  )
}

const mergeSandbox = async () => {
  if (!base.value?.id || !activeWorkspaceId.value || isMerging.value) return

  try {
    isMerging.value = true
    publishStatus.value = 'loading'
    publishErrorMessage.value = ''

    await $api.internal.postOperation(
      activeWorkspaceId.value,
      base.value.id,
      {
        operation: 'sandboxMerge',
      } as any,
      {},
    )

    publishStatus.value = 'success'
    // message.success('Sandbox changes merged successfully')
    // isPublishDialogOpen.value = false
  } catch (e: any) {
    publishStatus.value = 'error'
    publishErrorMessage.value = await extractSdkResponseErrorMsg(e)
    // message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isMerging.value = false
  }
}

const goToMasterBaseFromDialog = async () => {
  if (!sandboxInfo.value?.master_base_id) return
  isPublishDialogOpen.value = false
  // Reload master base to get updated state
  await basesStore.loadProject(sandboxInfo.value.master_base_id, true)
  await navigateTo(
    baseUrl({
      id: sandboxInfo.value.master_base_id,
      type: 'database',
      isSharedBase: false,
    }),
  )
}

const handlePublishDialogAction = () => {
  switch (publishStatus.value) {
    case 'pending':
      mergeSandbox()
      break
    case 'success':
      goToMasterBaseFromDialog()
      break
    case 'error':
      publishStatus.value = 'pending'
      publishErrorMessage.value = ''
      break
  }
}

const discardSandbox = async () => {
  if (!base.value?.id || !activeWorkspaceId.value) return

  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value,
      base.value.id,
      {
        operation: 'sandboxDiscard',
      } as any,
      {},
    )

    message.success('Sandbox changes reverted successfully')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/* const deleteSandbox = async () => {
  if (!base.value?.id || !activeWorkspaceId.value) return

  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value,
      base.value.id,
      {
        operation: 'sandboxDelete',
      } as any,
      {},
    )

    message.success('Sandbox deleted successfully')

    // Navigate to master base
    if (sandboxInfo.value?.master_base_id) {
      const masterBaseId = sandboxInfo.value.master_base_id

      // Reload master base to get updated state
      await basesStore.loadProject(masterBaseId, true)

      await navigateTo(
        baseUrl({
          id: masterBaseId,
          type: 'database',
          isSharedBase: false,
        }),
      )
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
} */

const colors = {
  orange: {
    bg: 'bg-nc-orange-20 dark:bg-nc-orange-20',
    border: 'border-nc-orange-200 dark:border-orange-600/40',
    text: 'text-orange-600',
  },
}
</script>

<template>
  <NcDropdown v-if="isSandbox" v-model:visible="isOpenDropdown" placement="bottomRight">
    <div class="flex items-center gap-2">
      <div
        class="flex items-center gap-2 px-2.5 py-1 h-8 rounded-lg border-1 cursor-pointer transition-colors select-none"
        :class="[colors.orange.bg, colors.orange.border, colors.orange.text]"
      >
        <GeneralIcon icon="ncGitBranch" class="w-3.5 h-3.5 text-current" />
        <span class="text-xs font-medium whitespace-nowrap"> Sandbox </span>
        <GeneralIcon
          icon="chevronDown"
          class="w-3.5 h-3.5 text-nc-content-gray-muted opacity-80 transform transition-all duration-200"
          :class="{
            'rotate-180': isOpenDropdown,
          }"
        />
      </div>
    </div>
    <template #overlay>
      <div class="nc-sandbox-status-menu flex flex-col">
        <div class="nc-sandbox-status-menu-header">
          <span class="uppercase">Sandbox Environment</span>
        </div>

        <!-- Current sandbox state -->
        <SmartsheetTopbarManagedAppStatusMenuItem label="Sandbox Active" icon-wrapper-class="bg-orange-50 dark:bg-nc-orange-20">
          <template #icon>
            <GeneralIcon icon="ncGitBranch" class="text-orange-600" />
          </template>
          <template #subtext>
            <span class="text-orange-600"> Editing in isolated environment </span>
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>

        <NcDivider class="!my-1" />

        <!-- Publish changes to master -->
        <SmartsheetTopbarManagedAppStatusMenuItem
          clickable
          icon-wrapper-class="bg-green-50 dark:bg-nc-green-20"
          @click="openPublishDialog"
        >
          <template #icon>
            <GeneralIcon icon="ncArrowUp" class="text-green-600" />
          </template>
          <template #label>
            <span class="text-green-600"> Publish to Master </span>
          </template>
          <template #subtext> Push changes to the main base </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>

        <!-- Go to master base -->
        <SmartsheetTopbarManagedAppStatusMenuItem
          v-if="sandboxInfo?.master_base_id"
          clickable
          label="Go to Master Base"
          subtext="View the original base"
          icon-wrapper-class="bg-nc-bg-gray-light"
          @click="goToMasterBase"
        >
          <template #icon>
            <GeneralIcon icon="ncArrowRight" class="text-nc-content-gray-muted" />
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>

        <NcDivider class="!my-1" />

        <!-- Discard changes (revert to master) -->
        <SmartsheetTopbarManagedAppStatusMenuItem
          clickable
          label="Discard Changes"
          subtext="Revert all changes to match master"
          icon-wrapper-class="bg-nc-bg-gray-light"
          @click="discardSandbox"
        >
          <template #icon>
            <GeneralIcon icon="ncRefreshCcw" class="text-nc-content-gray-muted" />
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>

        <!-- Delete sandbox
        <SmartsheetTopbarManagedAppStatusMenuItem
          clickable
          label="Delete Sandbox"
          subtext="Delete sandbox and return to master"
          icon-wrapper-class="bg-nc-bg-gray-light"
          @click="deleteSandbox"
        >
          <template #icon>
            <GeneralIcon icon="delete" class="text-nc-content-gray-muted" />
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>
        -->
      </div>
    </template>
  </NcDropdown>

  <!-- Publish Dialog -->

  <NcModal v-model:visible="isPublishDialogOpen" size="small" wrap-class-name="nc-modal-sandbox-publish">
    <div class="flex flex-col gap-4 p-1">
      <!-- Header -->
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold">
        <template v-if="['pending', 'loading'].includes(publishStatus)">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncArrowUp" class="w-5 h-5 text-green-600" />
            <span>Publish Sandbox Changes</span>
          </div>
        </template>
        <template v-else-if="publishStatus === 'success'">
          <div class="flex items-center gap-2">
            <GeneralIcon class="text-green-600 w-6 h-6" icon="checkFill" />
            <div class="text-nc-content-gray-emphasis font-semibold">Sandbox Changes Published</div>
          </div>
        </template>
        <template v-else-if="publishStatus === 'error'">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncInfoSolid" class="flex-none !text-red-700 w-6 h-6" />
            <div class="text-nc-content-gray-emphasis font-semibold">Failed to Publish Changes</div>
          </div>
        </template>
      </div>

      <!-- Content -->
      <template v-if="['pending', 'loading'].includes(publishStatus)">
        <div class="mt-2">
          <NcAlert type="warning" class="!p-3">
            <template #icon>
              <GeneralIcon icon="ncAlertTriangle" class="w-4 h-4 text-nc-content-orange-dark" />
            </template>
            <template #description> This will merge all schema changes from this sandbox into the master base. </template>
          </NcAlert>
        </div>
      </template>
      <template v-else-if="publishStatus === 'success'">
        <div class="text-nc-content-gray-emphasis my-5 font-medium">
          Sandbox changes have been published successfully.<br /><br />
          You can now go to the master base to view the changes.
        </div>
      </template>
      <template v-else-if="publishStatus === 'error'">
        <div class="text-nc-content-gray-emphasis my-5 font-medium">
          {{ publishErrorMessage }}
        </div>
      </template>

      <!-- Footer -->
      <div class="flex flex-row gap-x-2 justify-end mt-5">
        <NcButton v-if="!isMerging" type="secondary" size="small" @click="isPublishDialogOpen = false">
          {{ publishStatus === 'success' ? 'Close' : $t('general.cancel') }}
        </NcButton>
        <NcButton size="small" :loading="isMerging" :disabled="isMerging" @click="handlePublishDialogAction">
          <template v-if="publishStatus === 'pending'">
            <GeneralIcon icon="ncArrowUp" class="w-4 h-4 mr-1" />
            Publish Changes
          </template>
          <template v-else-if="publishStatus === 'loading'"> Publishing... </template>
          <template v-else-if="publishStatus === 'success'">
            <GeneralIcon icon="ncArrowRight" class="w-4 h-4 mr-1" />
            Go to Master Base
          </template>
          <template v-else-if="publishStatus === 'error'"> Try Again </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-sandbox-status-menu {
  @apply w-[318px] pb-1;
}

.nc-sandbox-status-menu-header {
  @apply flex items-center justify-between gap-2 pt-3 px-3.5 mb-1 text-nc-content-gray-muted text-captionSm;
}
</style>
