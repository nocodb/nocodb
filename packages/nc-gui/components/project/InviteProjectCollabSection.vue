<script lang="ts" setup>
import { OrderedProjectRoles, ProjectRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useDashboard, useManageUsers } from '#imports'

const emit = defineEmits(['invited'])

const inviteData = reactive({
  email: '',
  roles: ProjectRoles.VIEWER,
})

const { dashboardUrl } = useDashboard()

const { inviteUser } = useManageUsers()

const { $e } = useNuxtApp()

const { projectRoles } = useRoles()

const usersData = ref<{
  invite_token?: string
  email?: string
  roles?: string
}>()

const isInvitingCollaborators = ref(false)

const inviteCollaborator = async () => {
  if (isInvitingCollaborators.value) return

  isInvitingCollaborators.value = true

  try {
    usersData.value = await inviteUser(inviteData)
    usersData.roles = inviteData.roles
    if (usersData.value) {
      message.success('Invitation sent successfully')
      inviteData.email = ''
      emit('invited')
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  isInvitingCollaborators.value = false
}

const inviteUrl = computed(() =>
  usersData.value?.invite_token ? `${dashboardUrl.value}#/signup/${usersData.value.invite_token}` : null,
)

// allow only lower roles to be assigned
const allowedRoles = ref<ProjectRoles[]>([])

onMounted(async () => {
  try {
    const currentRoleIndex = OrderedProjectRoles.findIndex(
      (role) => projectRoles.value && Object.keys(projectRoles.value).includes(role),
    )
    if (currentRoleIndex !== -1) {
      allowedRoles.value = OrderedProjectRoles.slice(currentRoleIndex).filter((r) => r && r !== ProjectRoles.OWNER)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
})

const { copy } = useCopy(true)

const { t } = useI18n()

const copyUrl = async () => {
  if (!inviteUrl.value) return
  try {
    await copy(inviteUrl.value)

    // Copied shareable base url to clipboard!
    message.success(t('msg.success.shareableURLCopied'))
  } catch (e: any) {
    message.error(e.message)
  }
  $e('c:shared-base:copy-url')
}
</script>

<template>
  <div class="my-2 pt-3 ml-2" data-testid="invite">
    <template v-if="usersData && usersData.invite_token">
      <div class="flex flex-col mt-4 border-b-1 pb-5">
        <div class="flex flex-row items-center pl-1.5 pb-1 h-[1.1rem]">
          <div class="text-xs ml-0.5 mt-0.5">Copy Invite Token</div>
        </div>

        <a-alert class="mt-1" type="success" show-icon>
          <template #message>
            <div class="flex flex-row justify-between items-center py-1">
              <div class="flex pl-2 text-green-700 text-xs" data-testid="invite-modal-invitation-url">
                {{ inviteUrl }}
              </div>

              <a-button type="text" class="!rounded-md -mt-0.5" @click="copyUrl">
                <template #icon>
                  <GeneralIcon icon="copy" class="nc-view-icon"></GeneralIcon>
                </template>
              </a-button>
            </div>
          </template>
        </a-alert>

        <div class="flex text-xs text-gray-500 mt-2 justify-start ml-2">
          {{ $t('msg.info.userInviteNoSMTP') }}
          {{ usersData.invite_token && usersData.emails }}
        </div>

        <div class="flex flex-row justify-start mt-4 ml-2">
          <a-button size="small" outlined @click="usersData = null">
            <div class="flex flex-row justify-center items-center space-x-0.5">
              <MaterialSymbolsSendOutline class="flex mx-auto text-gray-600 h-[0.8rem]" />

              <div class="text-xs text-gray-600">{{ $t('activity.inviteMore') }}</div>
            </div>
          </a-button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="text-xl mb-4">Invite</div>
      <a-form>
        <div class="flex gap-2">
          <a-input
            id="email"
            v-model:value="inviteData.email"
            placeholder="Enter emails to send invitation"
            class="!max-w-130 !rounded"
          />

          <RolesSelector
            class="px-1"
            :role="inviteData.roles"
            :roles="allowedRoles"
            :on-role-change="(role: ProjectRoles) => (inviteData.roles = role)"
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
    </template>
  </div>
</template>

<style scoped>
.badge-text {
  @apply text-[14px] pt-1 text-center font-medium first-letter:uppercase;
}

:deep(.ant-select .ant-select-selector) {
  @apply rounded;
}

:deep(.ant-select-selection-item) {
  @apply mt-0.75;
}
</style>
