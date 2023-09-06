<script lang="ts" setup>
import { OrderedWorkspaceRoles, RoleColors, RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useWorkspace } from '#imports'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
})

const workspaceStore = useWorkspace()

const { inviteCollaborator: _inviteCollaborator } = workspaceStore
const { isInvitingCollaborators } = storeToRefs(workspaceStore)
const { workspaceRoles } = useRoles()

const inviteCollaborator = async () => {
  try {
    await _inviteCollaborator(inviteData.email, inviteData.roles)
    message.success('Invitation sent successfully')
    inviteData.email = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
// all user input emails are stored here
const emailBadges = ref<Array<string>>([])
watch(inviteData, (newVal) => {
  if (newVal.email.includes(',')) {
    emailBadges.value.push(newVal.email.split(',')[0])
    inviteData.email = ''
  }
})

// allow only lower roles to be assigned
const allowedRoles = ref<WorkspaceUserRoles[]>([])

onMounted(async () => {
  try {
    const currentRoleIndex = OrderedWorkspaceRoles.findIndex(
      (role) => workspaceRoles.value && Object.keys(workspaceRoles.value).includes(role),
    )
    if (currentRoleIndex !== -1) {
      allowedRoles.value = OrderedWorkspaceRoles.slice(currentRoleIndex + 1).filter((r) => r)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
})
</script>

<template>
  <div class="my-2 pt-3 ml-2" data-testid="invite">
    <div class="text-xl mb-4">Invite</div>
    <a-form>
      <div class="flex gap-2">
        <span
          v-for="(email, index) in emailBadges"
          :key="email"
          class="p-1 border-1 border-grey rounded-2xl flex items-center justify-between"
        >
          {{ email }}
          <component :is="iconMap.close" class="ml-1.5 hover:cursor-pointer" @click="emailBadges.splice(index, 1)" />
        </span>
        <a-input
          id="email"
          v-model:value="inviteData.email"
          placeholder="Enter emails to send invitation"
          class="!max-w-130 !rounded"
          @press-enter="inviteData.email += ','"
        />

        <RolesSelector
          class="px-1"
          :role="inviteData.roles"
          :roles="allowedRoles"
          :on-role-change="(role: WorkspaceUserRoles) => (inviteData.roles = role)"
          :description="true"
        />

        <a-button
          type="primary"
          class="!rounded-md"
          :disabled="!inviteData.email?.length || isInvitingCollaborators"
          @click="inviteCollaborator"
        >
          <div class="flex flex-row items-center gap-x-2 pr-1">
            <GeneralLoader v-if="isInvitingCollaborators" class="flex" />
            <MdiPlus v-else />
            {{ isInvitingCollaborators ? 'Adding' : 'Add' }} User(s)
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
