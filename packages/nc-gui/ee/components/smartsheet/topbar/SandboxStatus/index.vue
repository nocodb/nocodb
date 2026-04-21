<script setup lang="ts">
const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const baseStore = useBase()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { base, isSandbox, isSandboxMaster, sandboxInfo } = storeToRefs(baseStore)

const { baseUrl } = baseStore

const { openDrawer, loadChangelog } = useSandboxChangelog()

const isOpenDropdown = ref<boolean>(false)
const isMasterDropdownOpen = ref<boolean>(false)

const hasChanges = ref(true)
const isCheckingChanges = ref(false)
const isDiscarding = ref(false)

const checkForChanges = async () => {
  if (!base.value?.id || !activeWorkspaceId.value || isCheckingChanges.value) return

  isCheckingChanges.value = true
  try {
    const response = (await $api.internal.getOperation(activeWorkspaceId.value, base.value.id, {
      operation: 'sandboxDiff',
    })) as { diff?: { add?: Record<string, any[]>; delete?: Record<string, any[]>; update?: Record<string, any[]> } }

    const diff = response?.diff
    if (!diff) {
      hasChanges.value = false
      return
    }

    const hasAdds = Object.values(diff.add || {}).some((arr) => arr.length > 0)
    const hasDeletes = Object.values(diff.delete || {}).some((arr) => arr.length > 0)
    const hasUpdates = Object.values(diff.update || {}).some((arr) => arr.length > 0)

    hasChanges.value = hasAdds || hasDeletes || hasUpdates
  } catch (_e) {
    hasChanges.value = true
  } finally {
    isCheckingChanges.value = false
  }
}

const debouncedCheckForChanges = useDebounceFn(checkForChanges, 500)

watch(isOpenDropdown, (open) => {
  if (open) {
    debouncedCheckForChanges()
  }
})

const openSandboxDrawer = () => {
  isOpenDropdown.value = false
  openDrawer()
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

const { showWarningModal } = useNcConfirmModal()

const discardSandbox = async () => {
  if (!base.value?.id || !activeWorkspaceId.value || isDiscarding.value) return

  isOpenDropdown.value = false

  showWarningModal({
    title: t('labels.discardChanges'),
    content: t('labels.discardSandboxWarning'),
    showCancelBtn: true,
    showOkLoading: true,
    okCallback: async () => {
      if (isDiscarding.value) return
      isDiscarding.value = true

      try {
        const baseId = base.value!.id!
        const wsId = activeWorkspaceId.value!

        await $api.internal.postOperation(wsId, baseId, { operation: 'sandboxDiscard' }, {})

        message.success(t('labels.sandboxChangesReverted'))

        loadChangelog()

        await navigateTo(
          baseUrl({
            id: baseId,
            type: 'database',
            isSharedBase: false,
          }),
        )

        $e('a:sandbox:discard')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isDiscarding.value = false
      }
    },
  })
}

const goToSandbox = async () => {
  if (!sandboxInfo.value?.sandbox_base_id) return

  isMasterDropdownOpen.value = false

  await navigateTo(
    baseUrl({
      id: sandboxInfo.value.sandbox_base_id,
      type: 'database',
      isSharedBase: false,
    }),
  )
}

const isDeletingSandbox = ref(false)

const deleteSandbox = () => {
  if (!sandboxInfo.value?.sandbox_base_id || !activeWorkspaceId.value) return

  isMasterDropdownOpen.value = false

  showWarningModal({
    title: t('labels.deleteSandbox'),
    content: t('labels.deleteSandboxWarning'),
    showCancelBtn: true,
    showOkLoading: true,
    okCallback: async () => {
      if (isDeletingSandbox.value) return
      isDeletingSandbox.value = true

      try {
        await $api.internal.postOperation(
          activeWorkspaceId.value!,
          sandboxInfo.value!.sandbox_base_id,
          { operation: 'sandboxDelete' },
          {},
        )

        const sandboxBaseId = sandboxInfo.value!.sandbox_base_id

        message.success(t('labels.sandboxDeleted'))

        sandboxInfo.value = null
        basesStore.bases.delete(sandboxBaseId)
        await baseStore.loadProject(true)

        $e('a:sandbox:delete')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isDeletingSandbox.value = false
      }
    },
  })
}
</script>

<template>
  <NcDropdown v-if="isSandbox" v-model:visible="isOpenDropdown" placement="bottomRight">
    <NcButton type="secondary" size="small" class="!border-nc-orange-200 !text-orange-600 !font-normal !bg-nc-orange-20">
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="ncGitBranch" class="w-4 h-4 !stroke-transparent" />
        <span>{{ t('labels.sandbox') }}</span>
        <GeneralIcon
          icon="chevronDown"
          class="w-3.5 h-3.5 text-orange-600 opacity-80 transform transition-all duration-200"
          :class="{ 'rotate-180': isOpenDropdown }"
        />
      </div>
    </NcButton>
    <template #overlay>
      <div class="nc-sandbox-status-menu flex flex-col">
        <div class="nc-sandbox-status-menu-header">
          <span class="uppercase">{{ t('labels.sandboxEnvironment') }}</span>
        </div>

        <div class="flex items-start gap-2 mx-2 my-1 px-3 py-2.5 rounded-lg bg-orange-50 text-xs leading-4">
          <GeneralIcon icon="ncGitBranch" class="w-4 h-4 text-orange-600 mt-0.5 flex-none" />
          <span class="text-orange-600">{{ t('labels.editingInIsolatedEnvironment') }}</span>
        </div>

        <NcDivider class="!my-1" />

        <!-- Publish changes to master -->
        <NcTooltip :disabled="hasChanges" placement="bottom">
          <template #title>{{ $t('tooltip.noSchemaChanges') }}</template>
          <SmartsheetTopbarManagedAppStatusMenuItem
            :clickable="hasChanges"
            :icon-wrapper-class="hasChanges ? 'bg-green-50 dark:bg-nc-green-20' : 'bg-nc-bg-gray-light'"
            :class="{ 'opacity-50 cursor-not-allowed': !hasChanges }"
            @click="hasChanges && openSandboxDrawer()"
          >
            <template #icon>
              <GeneralLoader v-if="isCheckingChanges" size="small" />
              <GeneralIcon v-else icon="ncArrowUp" :class="hasChanges ? 'text-green-600' : 'text-nc-content-gray-muted'" />
            </template>
            <template #label>
              <span :class="hasChanges ? 'text-green-600' : 'text-nc-content-gray-muted'">
                {{ t('labels.publishToMaster') }}
              </span>
            </template>
            <template #subtext> {{ t('labels.pushChangesToMainBase') }} </template>
          </SmartsheetTopbarManagedAppStatusMenuItem>
        </NcTooltip>

        <!-- Go to master base -->
        <SmartsheetTopbarManagedAppStatusMenuItem
          v-if="sandboxInfo?.master_base_id"
          clickable
          :label="t('labels.goToMasterBase')"
          :subtext="t('labels.viewOriginalBase')"
          icon-wrapper-class="bg-nc-bg-gray-light"
          @click="goToMasterBase"
        >
          <template #icon>
            <GeneralIcon icon="ncArrowRight" class="text-nc-content-gray-muted" />
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>

        <!-- Sandbox changes
        <SmartsheetTopbarManagedAppStatusMenuItem
          clickable
          icon-wrapper-class="bg-orange-50 dark:bg-nc-orange-20"
          @click="openSandboxDrawer"
        >
          <template #icon>
            <GeneralIcon icon="ncGitBranch" class="text-orange-600" />
          </template>
          <template #label>
            <span class="text-nc-content-gray-emphasis">{{ t('labels.sandboxChanges') }}</span>
          </template>
          <template #subtext>{{ t('labels.viewSandboxChanges') }}</template>
        </SmartsheetTopbarManagedAppStatusMenuItem>
        -->

        <NcDivider class="!my-1" />

        <!-- Discard changes -->
        <NcTooltip :disabled="hasChanges" placement="bottom">
          <template #title>{{ $t('tooltip.noSchemaChanges') }}</template>
          <SmartsheetTopbarManagedAppStatusMenuItem
            :clickable="hasChanges"
            :label="t('labels.discardChanges')"
            :subtext="t('labels.revertAllChangesToMatchMaster')"
            icon-wrapper-class="bg-nc-bg-gray-light"
            :class="{ 'opacity-50 cursor-not-allowed': !hasChanges }"
            @click="hasChanges && discardSandbox()"
          >
            <template #icon>
              <GeneralIcon icon="ncRefreshCcw" class="text-nc-content-gray-muted" />
            </template>
          </SmartsheetTopbarManagedAppStatusMenuItem>
        </NcTooltip>
      </div>
    </template>
  </NcDropdown>

  <!-- Master: Schema Locked indicator -->
  <NcDropdown v-if="isSandboxMaster && !isSandbox" v-model:visible="isMasterDropdownOpen" placement="bottomRight">
    <NcButton type="secondary" size="small" class="!border-nc-orange-200 !text-orange-600 !font-normal !bg-nc-orange-20">
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="ncLock" class="w-4 h-4" />
        <span>{{ t('labels.master') }}</span>
        <GeneralIcon
          icon="chevronDown"
          class="w-3.5 h-3.5 text-orange-600 opacity-80 transform transition-all duration-200"
          :class="{ 'rotate-180': isMasterDropdownOpen }"
        />
      </div>
    </NcButton>
    <template #overlay>
      <div class="nc-sandbox-status-menu flex flex-col">
        <div class="nc-sandbox-status-menu-header">
          <span class="uppercase">{{ t('labels.schemaLocked') }}</span>
        </div>

        <div
          class="flex items-start gap-2 mx-2 my-1 px-3 py-2.5 rounded-lg bg-nc-bg-gray-extralight text-xs text-nc-content-gray-subtle2 leading-4"
        >
          <GeneralIcon icon="ncLock" class="w-4 h-4 text-nc-content-gray-subtle mt-0.5 flex-none" />
          <span>{{ t('labels.schemaLockedDescription') }}</span>
        </div>

        <NcDivider class="!my-1" />

        <SmartsheetTopbarManagedAppStatusMenuItem
          clickable
          icon-wrapper-class="bg-orange-50 dark:bg-nc-orange-20"
          @click="goToSandbox"
        >
          <template #icon>
            <GeneralIcon icon="ncGitBranch" class="text-orange-600" />
          </template>
          <template #label>
            {{ t('labels.goToSandbox') }}
          </template>
          <template #subtext>
            {{ t('labels.openSandboxToEditSchema') }}
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>

        <NcDivider class="!my-1" />

        <SmartsheetTopbarManagedAppStatusMenuItem
          clickable
          icon-wrapper-class="bg-nc-bg-gray-light"
          @click="deleteSandbox"
        >
          <template #icon>
            <GeneralIcon icon="delete" class="text-nc-content-red-dark" />
          </template>
          <template #label>
            <span class="text-nc-content-red-dark">{{ t('labels.deleteSandbox') }}</span>
          </template>
          <template #subtext>
            {{ t('labels.permanentlyRemoveSandbox') }}
          </template>
        </SmartsheetTopbarManagedAppStatusMenuItem>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-sandbox-status-menu {
  @apply w-[318px] pb-1;
}

.nc-sandbox-status-menu-header {
  @apply flex items-center justify-between gap-2 pt-3 px-3.5 mb-1 text-nc-content-gray-muted text-captionSm;
}
</style>
