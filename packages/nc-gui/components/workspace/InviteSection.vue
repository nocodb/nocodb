<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import { OrderedWorkspaceRoles, RoleColors, RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useWorkspace } from '#imports'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
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

const workspaceStore = useWorkspace()

const { inviteCollaborator: _inviteCollaborator } = workspaceStore
const { isInvitingCollaborators } = storeToRefs(workspaceStore)
const { workspaceRoles } = useRoles()

// all user input emails are stored here
const emailBadges = ref<Array<string>>([])

const insertOrUpdateString = (str: string) => {
  // Check if the string already exists in the array
  const index = emailBadges.value.indexOf(str)

  if (index !== -1) {
    // If the string exists, remove it
    emailBadges.value.splice(index, 1)
  }

  // Add the new string to the array
  emailBadges.value.push(str)
}

watch(inviteData, (newVal) => {
  const isNewEmail = newVal.email.charAt(newVal.email.length - 1) === ',' || newVal.email.charAt(newVal.email.length - 1) === ' '
  if (isNewEmail && newVal.email.trim().length > 1) {
    const emailToAdd = newVal.email.split(',')[0].trim() || newVal.email.split(' ')[0].trim()
    if (!validateEmail(emailToAdd)) {
      emailValidation.isError = true
      emailValidation.message = 'INVALID EMAIL'
      return
    }
    /** 
     if email is already enterd we delete the already
     existing email and add new one
     **/
    if (emailBadges.value.includes(emailToAdd)) {
      insertOrUpdateString(emailToAdd)
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
    emailValidation.message = 'EMAIL SHOULD NOT BE EMPTY'
    return
  }
  if (!validateEmail(inviteData.email.trim())) {
    emailValidation.isError = true
    emailValidation.message = 'INVALID EMAIL'
    return
  }
  inviteData.email += ' '
  emailValidation.isError = false
  emailValidation.message = ''
}

const inviteCollaborator = async () => {
  try {
    let inviteEmails = ''
    emailBadges.value.forEach((el, index) => {
      // prevent the last email from getting the ","
      if (index === emailBadges.value.length - 1) {
        inviteEmails += el
      } else {
        inviteEmails += `${el},`
      }
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
  if (inputArray?.length === 1 && inviteData.email.length > 1) {
    inputArray[0] = inviteData.email += inputArray[0]
  }
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
    /** 
     if email is already enterd we delete the already
     existing email and add new one
     **/
    if (emailBadges.value.includes(el)) {
      insertOrUpdateString(el)
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
    <div class="text-xl mb-4">Invite</div>
    <div class="flex gap-2">
      <div class="flex flex-col items-cenyet">
        <div
          ref="divRef"
          class="flex w-130 border-1 gap-1 items-center flex-wrap min-h-8 max-h-30 overflow-y-scroll rounded-lg nc-scrollbar-md"
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
            @blur="isDivFocused = false"
            @paste.prevent="onPaste"
          />
        </div>
        <span v-if="emailValidation.isError" class="ml-2 text-red-500 text-[10px] mt-1.5">{{ emailValidation.message }}</span>
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
        :disabled="!emailBadges.length || isInvitingCollaborators || emailValidation.isError"
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
