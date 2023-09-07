<script lang="ts" setup>
import { OrderedWorkspaceRoles, RoleColors, RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useWorkspace } from '#imports'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
})

const workspaceStore = useWorkspace()

const { inviteCollaborator: _inviteCollaborator } = workspaceStore
const { isInvitingCollaborators, workspaceRole } = storeToRefs(workspaceStore)

const inviteCollaborator = async () => {
  try {
    await _inviteCollaborator(inviteData.email, inviteData.roles)
    message.success('Invitation sent successfully')
    inviteData.email = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// allow only lower roles to be assigned
const allowedRoles = computed<WorkspaceUserRoles[]>(() => {
  const currentRoleIndex = OrderedWorkspaceRoles.findIndex((role) => role === workspaceRole.value)
  return OrderedWorkspaceRoles.slice(currentRoleIndex + 1)
})
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

        <NcSelect v-model:value="inviteData.roles" class="min-w-30 !rounded px-1" data-testid="roles">
          <template #suffixIcon>
            <MdiChevronDown />
          </template>
          <template v-for="role of allowedRoles" :key="`role-option-${role}`">
            <a-select-option v-if="role" :value="role">
              <NcBadge :color="RoleColors[role]">
                <p class="badge-text">{{ RoleLabels[role] }}</p>
              </NcBadge>
            </a-select-option>
          </template>
        </NcSelect>

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

.badge-text {
  @apply text-[14px] pt-1 text-center;
}

:deep(.ant-select-selection-item) {
  @apply mt-0.75;
}
</style>
