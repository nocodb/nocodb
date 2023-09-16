<script lang="ts" setup>
import { OrderedProjectRoles, ProjectRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useDashboard, useManageUsers } from '#imports'

const emit = defineEmits(['invited'])

const inviteData = reactive({
  email: '',
  roles: ProjectRoles.VIEWER,
})

const focusRef = ref<HTMLInputElement>()
const isDivFocused = ref(false)
const divRef = ref<HTMLDivElement>()

const emailValidation = reactive({
  isError: false,
  message: '',
})

const validateEmail = (email: string): boolean => {
  const regEx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regEx.test(email)
}

// all user input emails are stored here
const emailBadges = ref<Array<string>>([])
watch(inviteData, (newVal) => {
  const isNewEmail = newVal.email.includes(' ') || newVal.email.includes(',')
  if (isNewEmail) {
    if (inviteData.email.length < 1) {
      emailValidation.isError = true
      emailValidation.message = 'email should not be empty'
      return
    }
    if (!validateEmail(inviteData.email.trim())) {
      emailValidation.isError = true
      emailValidation.message = 'invalid email'
      return
    }
    // if email is already enterd we just ignore the input
    // no error is thrown
    const emailToAdd = newVal.email.split(',')[0].trim() || newVal.email.split(' ')[0].trim()
    if (emailBadges.value.includes(emailToAdd)) {
      inviteData.email = ''
      return
    }
    emailBadges.value.push(emailToAdd)
    inviteData.email = ''
  }
  if (newVal.email.length < 1 && emailValidation.isError) {
    emailValidation.isError = false
  }
})

const handleEnter = () => {
  if (inviteData.email.length < 1) {
    emailValidation.isError = true
    emailValidation.message = 'email should not be empty'
    return
  }
  if (!validateEmail(inviteData.email.trim())) {
    emailValidation.isError = true
    emailValidation.message = 'invalid email'
    return
  }
  inviteData.email += ' '
  emailValidation.isError = false
  emailValidation.message = ''
}

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
    emailBadges.value.forEach((el, index) => {
      // prevent the last email from getting the ","
      if (index === emailBadges.value.length - 1) {
        inviteData.email += el
      } else {
        inviteData.email += `${el},`
      }
    })
    usersData.value = await inviteUser(inviteData)
    usersData.roles = inviteData.roles
    if (usersData.value) {
      message.success('Invitation sent successfully')
      inviteData.email = ''
      emailBadges.value = []
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
    inviteData.email = ''
    emailBadges.value = []
  } catch (e: any) {
    message.error(e.message)
  }
  $e('c:shared-base:copy-url')
}

const focusOnDiv = () => {
  focusRef.value?.focus()
  isDivFocused.value = true
}

// remove one email per backspace
onKeyStroke('Backspace', () => {
  if (isDivFocused.value && inviteData.email.length < 1) {
    emailBadges.value.pop()
  }
})

// when bulk email is pasted
const onPaste = (e: ClipboardEvent) => {
  const pastedText = e.clipboardData?.getData('text')
  const inputArray = pastedText?.split(',') || pastedText?.split(' ')
  inputArray?.forEach((el) => {
    if (el.length < 1) {
      emailValidation.isError = true
      emailValidation.message = 'EMAIL SHOULD NOT BE EMPTY'
      return
    }
    if (!validateEmail(el.trim())) {
      emailValidation.isError = true
      emailValidation.message = 'INVALID EMAIL'
      return
    }
    // if email is already enterd we just ignore the input
    // no error is thrown
    if (emailBadges.value.includes(el)) {
      return
    }

    emailBadges.value.push(el)
    inviteData.email = ''
  })
  inviteData.email = ''
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
          <div class="flex flex-col">
            <div
              ref="divRef"
              class="flex w-130 border-1 gap-1 items-center min-h-8 flex-wrap max-h-30 overflow-y-scroll rounded-lg nc-scrollbar-md"
              tabindex="0"
              :class="{
                'border-primary/100': isDivFocused,
                'p-1': emailBadges.length > 1,
              }"
              @click="focusOnDiv"
              @blur="isDivFocused = false"
            >
              <span
                v-for="(email, index) in emailBadges"
                :key="email"
                class="text-[14px] border-1 text-brand-500 bg-brand-50 rounded-md ml-1 p-0.5"
              >
                {{ email }}
                <component
                  :is="iconMap.close"
                  class="ml-0.5 hover:cursor-pointer w-3.5 h-3.5"
                  @click="emailBadges.splice(index, 1)"
                />
              </span>
              <input
                id="email"
                ref="focusRef"
                v-model="inviteData.email"
                :placeholder="emailBadges.length < 1 ? 'Enter emails to send invitation' : ''"
                class="min-w-50 !outline-0 !focus:outline-0 ml-2 mr-3"
                data-testid="email-input"
                @keyup.enter="handleEnter"
                @paste.prevent="onPaste"
                @blur="isDivFocused = false"
              />
            </div>
            <span v-if="emailValidation.isError" class="ml-2 text-red-500 text-[12px] mt-1">{{ emailValidation.message }}</span>
          </div>

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
            :disabled="!emailBadges.length || isInvitingCollaborators || emailValidation.isErro"
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
