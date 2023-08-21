<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useWorkspace } from '#imports'

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
        <a-input id="email" v-model:value="inviteData.email" placeholder="Enter emails to send invitation"
          class="!max-w-130 !rounded" />

        <NcSelect v-model:value="inviteData.roles" class="min-w-30 !rounded px-1" data-testid="roles">
          <template #suffixIcon>
            <MdiChevronDown />
          </template>
          <a-select-option :value="WorkspaceUserRoles.CREATOR">
            <NcBadge color="blue">
              <p class="badge-text">Creator</p>
            </NcBadge>
          </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.EDITOR">
            <NcBadge color="green">
              <p class="badge-text">Editor</p>
            </NcBadge>
          </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.COMMENTER">
            <NcBadge color="orange">
              <p class="badge-text">Commenter</p>
            </NcBadge>
          </a-select-option>
          <a-select-option :value="WorkspaceUserRoles.VIEWER">
            <NcBadge color="yellow">
              <p class="badge-text">Viewer</p>
            </NcBadge>
          </a-select-option>
        </NcSelect>

        <a-button type="primary" class="!rounded-md" :disabled="!inviteData.email?.length || isInvitingCollaborators"
          @click="inviteCollaborator">
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

.badge-text {
    @apply text-[14px] pt-1 text-center
}
</style>
