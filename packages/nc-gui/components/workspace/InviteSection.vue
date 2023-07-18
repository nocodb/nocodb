<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg } from '~/utils'
import { useWorkspace } from '~/store/workspace'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
})

const workspaceStore = useWorkspace()

const { inviteCollaborator: _inviteCollaborator } = workspaceStore
const { isInvitingCollaborators } = storeToRefs(workspaceStore)

const inviteCollaborator = async () => {
  try {
    await _inviteCollaborator(inviteData.email, inviteData.roles)
    message.success('Invitation sent successfully')
    inviteData.email = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="my-2 pt-3 ml-2" data-testid="invite">
    <div class="text-xl mb-4">Invite</div>
    <a-form>
      <div class="flex gap-2">
        <a-input
          id="email"
          v-model:value="inviteData.email"
          placeholder="Enter emails to send invitation"
          class="!max-w-130 !rounded"
        />

        <a-select v-model:value="inviteData.roles" class="min-w-30 !rounded px-1" data-testid="roles">
          <template #suffixIcon>
            <MdiChevronDown />
          </template>
          <a-select-option :value="WorkspaceUserRoles.CREATOR"> Creator </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.EDITOR"> Editor </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.COMMENTER"> Commenter </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.VIEWER"> Viewer </a-select-option>
        </a-select>

        <a-button
          type="primary"
          class="!rounded-md"
          :disabled="!inviteData.email?.length || isInvitingCollaborators"
          @click="inviteCollaborator"
        >
          <div class="flex flex-row items-center gap-x-2 pr-1">
            <GeneralLoader v-if="isInvitingCollaborators" class="flex" />
            <MdiPlus v-else />
            {{ isInvitingCollaborators ? 'Adding' : 'Add' }} User/s
          </div>
        </a-button>
      </div>
    </a-form>
  </div>
</template>

<style scoped>
:deep(.ant-select .ant-select-selector) {
  @apply rounded;
}
</style>
