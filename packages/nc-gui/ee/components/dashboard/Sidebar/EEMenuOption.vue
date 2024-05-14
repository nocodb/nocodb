<script lang="ts" setup>
import type { Api } from 'nocodb-sdk'

const { isUIAllowed } = useRoles()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const { api } = useApi()

const migrateWorkspace = async () => {
  try {
    await (api as Api<any>).orgWorkspace.upgrade(activeWorkspace.value?.id)
    await workspaceStore.loadWorkspace(activeWorkspace.value?.id)
    if (activeWorkspace.value?.fk_org_id) {
      navigateTo(`/admin/${activeWorkspace.value.fk_org_id}/settings?isCreatedFromWorkspace=true`)
    }
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <template v-if="activeWorkspace?.fk_org_id">
    <nuxt-link
      v-if="isUIAllowed('orgAdminPanel')"
      v-e="['c:user:admin-panel']"
      :to="`/admin/${activeWorkspace?.fk_org_id}`"
      class="!no-underline"
      data-testid="nc-sidebar-org-admin-panel"
    >
      <NcMenuItem> <GeneralIcon class="menu-icon" icon="controlPanel" /> {{ $t('labels.adminPanel') }} </NcMenuItem>
    </nuxt-link>
  </template>
  <div
    v-else-if="isUIAllowed('moveWorkspaceToOrg') && true"
    v-e="['c:user:upgrade-workspace-to-org']"
    data-testid="nc-sidebar-upgrade-workspace-to-org"
    @click="migrateWorkspace"
  >
    <NcMenuItem> <GeneralIcon class="menu-icon" icon="controlPanel" /> {{ $t('labels.moveWorkspaceToOrg') }} </NcMenuItem>
  </div>
  <span v-else></span>
</template>
