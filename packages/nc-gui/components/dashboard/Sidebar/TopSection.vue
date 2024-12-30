<script setup lang="ts">
const workspaceStore = useWorkspace()
const baseStore = useBase()

const { isUIAllowed } = useRoles()

const { appInfo } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const { isWorkspaceLoading, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened } = storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings, navigateToIntegrations: _navigateToIntegrations } = workspaceStore

const { isSharedBase } = storeToRefs(baseStore)

const isCreateProjectOpen = ref(false)

const navigateToSettings = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  // TODO: Handle cloud case properly
  navigateToWorkspaceSettings('', cmdOrCtrl)

  // if (appInfo.value.baseHostName) {
  //   window.location.href = `https://app.${appInfo.value.baseHostName}/dashboard`
  // } else {
  // }
}

const navigateToIntegrations = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  _navigateToIntegrations('', cmdOrCtrl)
}
</script>

<template>
  <template v-if="isWorkspaceLoading">
    <div class="flex flex-col w-full gap-y-3.75 ml-3 mt-3.75">
      <div v-if="appInfo.ee" class="flex flex-row items-center w-full gap-x-3">
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
      <div class="flex flex-row items-center w-full gap-x-3">
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
      <div class="flex flex-row items-center w-full gap-x-3">
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
    </div>
  </template>
  <template v-else-if="!isSharedBase">
    <div class="xs:hidden flex flex-col p-1 mt-0.25 mb-0.5 truncate">
      <!-- <DashboardSidebarTopSectionHeader /> -->

      <NcButton
        v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
        v-e="['c:team:settings']"
        type="text"
        size="xsmall"
        class="nc-sidebar-top-button !xs:hidden my-0.5 !h-7"
        data-testid="nc-sidebar-team-settings-btn"
        :centered="false"
        :class="{
          '!text-brand-600 !bg-brand-50 !hover:bg-brand-50': isWorkspaceSettingsPageOpened,
          '!hover:(bg-gray-200 text-gray-700)': !isWorkspaceSettingsPageOpened,
        }"
        @click="navigateToSettings"
      >
        <div
          class="flex items-center gap-2"
          :class="{
            'font-semibold': isWorkspaceSettingsPageOpened,
          }"
        >
          <GeneralIcon icon="ncSettings" class="!h-4 w-4" />
          <div>{{ $t('title.teamAndSettings') }}</div>
        </div>
      </NcButton>
      <NcButton
        v-if="isUIAllowed('workspaceSettings')"
        v-e="['c:integrations']"
        type="text"
        size="xsmall"
        class="nc-sidebar-top-button !xs:hidden my-0.5 !h-7"
        data-testid="nc-sidebar-integrations-btn"
        :centered="false"
        :class="{
          '!text-brand-600 !bg-brand-50 !hover:bg-brand-50': isIntegrationsPageOpened,
          '!hover:(bg-gray-200 text-gray-700)': !isIntegrationsPageOpened,
        }"
        @click="navigateToIntegrations"
      >
        <div
          class="flex items-center gap-2"
          :class="{
            'font-semibold': isIntegrationsPageOpened,
          }"
        >
          <GeneralIcon icon="integration" class="!h-4" />
          <div>{{ $t('general.integrations') }}</div>
        </div>
      </NcButton>
      <WorkspaceCreateProjectBtn
        v-model:is-open="isCreateProjectOpen"
        modal
        type="text"
        class="nc-sidebar-top-button !hover:(bg-gray-200 text-gray-700) !xs:hidden !h-7 my-0.5"
        data-testid="nc-sidebar-create-base-btn"
      >
        <div class="gap-x-2 flex flex-row w-full items-center">
          <GeneralIcon icon="plus" />

          <div class="flex">{{ $t('title.createBase') }}</div>
        </div>
      </WorkspaceCreateProjectBtn>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply w-full !rounded-md !font-medium !px-3;
}
</style>
