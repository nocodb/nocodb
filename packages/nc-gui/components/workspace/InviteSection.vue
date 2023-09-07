<script lang="ts" setup>
import { OrderedWorkspaceRoles, RoleColors, RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useWorkspace } from '#imports'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
})

const focusRef = ref<HTMLInputElement>()

const divRef = ref<HTMLDivElement>()

const workspaceStore = useWorkspace()

const { inviteCollaborator: _inviteCollaborator } = workspaceStore
const { isInvitingCollaborators } = storeToRefs(workspaceStore)
const { workspaceRoles } = useRoles()

// all user input emails are stored here
const emailBadges = ref<Array<string>>([])
watch(inviteData, (newVal) => {
  if (newVal.email.includes(',')) {
    emailBadges.value.push(newVal.email.split(',')[0])
    inviteData.email = ''
  }
})

const scrollToEnd = () => {
  if (divRef.value) {
    const maxScrollLeft = divRef.value.scrollWidth - divRef.value.clientWidth
    divRef.value.scrollLeft = maxScrollLeft
  }
}

const handleEnter = () => {
  inviteData.email += ','
  scrollToEnd()
}

const inviteCollaborator = async () => {
  try {
    let inviteEmails = ''
    emailBadges.value.forEach((el) => {
      inviteEmails += `${el},`
    })

    await _inviteCollaborator(inviteEmails, inviteData.roles)
    message.success('Invitation sent successfully')
    inviteData.email = ''
    emailBadges.value = []
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
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
    <div class="flex gap-2">
      <div
        ref="divRef"
        class="flex w-130 gap-1 overflow-x-scroll border-1 border-blue items-center rounded-lg nc-scrollbar-x-md overflow-hidden"
        @click="focusRef?.focus"
      >
        <span
          v-for="(email, index) in emailBadges"
          :key="email"
          class="text-[14px] p-0.2 border-1 color-[#4A5268] bg-[#E7E7E9] rounded-md flex items-center justify-between ml-1"
        >
          {{ email }}
          <component :is="iconMap.close" class="ml-1.5 hover:cursor-pointer" @click="emailBadges.splice(index, 1)" />
        </span>
        <input
          id="email"
          ref="focusRef"
          v-model="inviteData.email"
          :placeholder="emailBadges.length < 1 ? 'Enter emails to send invitation' : ''"
          class="!border-none !focus:border-none !outline-0 !focus:outline-0 !bg-[white] ml-2 mr-3 w-full"
          @keyup.enter="handleEnter"
        />
      </div>
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

      <NcButton
        type="primary"
        :disabled="!emailBadges.length || isInvitingCollaborators"
        size="small"
        @click="inviteCollaborator"
      >
        <div class="flex flex-row items-center gap-x-2 pr-1">
          <GeneralLoader v-if="isInvitingCollaborators" class="flex" />
          <MdiPlus v-else />
          {{ isInvitingCollaborators ? 'Adding' : 'Add' }} User(s)
        </div>
      </NcButton>
    </div>
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
