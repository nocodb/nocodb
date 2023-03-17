<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { useWorkspaceStoreOrThrow } from '~/composables/useWorkspaceStore'
import { extractSdkResponseErrorMsg } from '~/utils'
import { useWorkspace } from '~/store/workspace'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
})

const workspaceStore = useWorkspace()

const { inviteCollaborator: _inviteCollaborator } = workspaceStore

const inviteCollaborator = async () => {
  try {
    await _inviteCollaborator(inviteData.email, inviteData.roles)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="my-4 mx-6">
    <a-form>
      <label for="email">Email</label>
      <div class="flex gap-2 mt-1">
        <a-input id="email" v-model:value="inviteData.email" placeholder="user@nocodb.com" class="!w-60 !rounded" />

        <a-select v-model:value="inviteData.roles" class="min-w-30 !rounded">
          <a-select-option :value="WorkspaceUserRoles.CREATOR"> Creator </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.VIEWER"> Viewer </a-select-option>
        </a-select>

        <a-button type="primary" class="!rounded" @click="inviteCollaborator">Send Invite</a-button>
      </div>
    </a-form>
  </div>
</template>

<style scoped>
:deep(.ant-select .ant-select-selector) {
  @apply rounded;
}
</style>
