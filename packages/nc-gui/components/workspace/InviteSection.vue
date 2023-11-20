<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import { OrderedWorkspaceRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useWorkspace } from '#imports'
import { validateEmail } from '~/utils/validation'

const inviteData = reactive({
  email: '',
  roles: WorkspaceUserRoles.VIEWER,
})

const focusRef = ref<HTMLInputElement>()
const isDivFocused = ref(false)
const divRef = ref<HTMLDivElement>()

const emailValidation = reactive({
  isError: true,
  message: '',
})
const singleEmailValue = ref('')

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

const emailInputValidation = (input: string): boolean => {
  if (!input.length) {
    emailValidation.isError = true
    emailValidation.message = 'Email should not be empty'
    return false
  }
  if (!validateEmail(input.trim())) {
    emailValidation.isError = true
    emailValidation.message = 'Invalid Email'
    return false
  }
  return true
}

const isInvitButtonDiabled = computed(() => {
  if (!emailBadges.value.length && !singleEmailValue.value.length) {
    return true
  }
  if (emailBadges.value.length && inviteData.email) {
    return true
  }
})

watch(inviteData, (newVal) => {
  // when user only want to enter a single email
  // we dont convert that as badge

  const isSingleEmailValid = validateEmail(newVal.email)
  if (isSingleEmailValid && !emailBadges.value.length) {
    singleEmailValue.value = newVal.email
    emailValidation.isError = false
    return
  }
  singleEmailValue.value = ''

  // when user enters multiple emails comma sepearted or space sepearted
  const isNewEmail = newVal.email.charAt(newVal.email.length - 1) === ',' || newVal.email.charAt(newVal.email.length - 1) === ' '
  if (isNewEmail && newVal.email.trim().length) {
    const emailToAdd = newVal.email.split(',')[0].trim() || newVal.email.split(' ')[0].trim()
    if (!validateEmail(emailToAdd)) {
      emailValidation.isError = true
      emailValidation.message = 'Invalid Email'
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
    singleEmailValue.value = ''
  }
  if (!newVal.email.length && emailValidation.isError) {
    emailValidation.isError = false
  }
})

const handleEnter = () => {
  const isEmailIsValid = emailInputValidation(inviteData.email)
  if (!isEmailIsValid) return

  inviteData.email += ' '
  emailValidation.isError = false
  emailValidation.message = ''
}

const inviteCollaborator = async () => {
  try {
    const payloadData = singleEmailValue.value || emailBadges.value.join(',')
    if (!payloadData.includes(',')) {
      const validationStatus = validateEmail(payloadData)
      if (!validationStatus) {
        emailValidation.isError = true
        emailValidation.message = 'invalid email'
      }
    }

    await _inviteCollaborator(payloadData, inviteData.roles)
    message.success('Invitation sent successfully')
    inviteData.email = ''
    emailBadges.value = []
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    singleEmailValue.value = ''
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

  // if data is pasted to a already existing text in input
  // we add existingInput + pasted data
  if (inputArray?.length === 1 && inviteData.email.length) {
    inputArray[0] = inviteData.email += inputArray[0]
  }

  inputArray?.forEach((el) => {
    const isEmailIsValid = emailInputValidation(el)

    if (!isEmailIsValid) return

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
    <div class="flex gap-2">
      <div class="flex flex-col">
        <div
          ref="divRef"
          class="flex w-130 border-1 gap-1 items-center flex-wrap min-h-8 max-h-30 rounded-lg nc-scrollbar-md"
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
            class="leading-4 border-1 text-brand-500 bg-brand-50 rounded-md ml-1 p-0.5"
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
            class="min-w-60 outline-0 ml-2 mr-3 flex-grow-1"
            data-testid="email-input"
            @keyup.enter="handleEnter"
            @blur="isDivFocused = false"
            @paste.prevent="onPaste"
          />
        </div>
        <span v-if="emailValidation.isError" class="ml-2 text-red-500 text-[10px] mt-1.5">{{ emailValidation.message }}</span>
      </div>
      <RolesSelector
        size="md"
        class="px-1"
        :role="inviteData.roles"
        :roles="allowedRoles"
        :on-role-change="(role: WorkspaceUserRoles) => (inviteData.roles = role)"
        :description="true"
      />

      <NcButton
        type="primary"
        size="small"
        :disabled="isInvitButtonDiabled || isInvitingCollaborators || emailValidation.isError"
        :loading="isInvitingCollaborators"
        @click="inviteCollaborator"
      >
        <MdiPlus />
        {{ isInvitingCollaborators ? 'Adding' : 'Add' }} Member(s)
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
