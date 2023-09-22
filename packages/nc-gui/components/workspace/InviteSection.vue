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
watch(inviteData, (newVal) => {
  if (newVal.email.includes(',')) {
    if (inviteData.email.length < 1) {
      emailValidation.isError = true
      emailValidation.message = 'email should not be empty'
      return
    }
    if (!validateEmail(inviteData.email)) {
      emailValidation.isError = true
      emailValidation.message = 'invalid email'
      return
    }
    // if email is already enterd we just ignore the input
    // no error is thrown
    if (emailBadges.value.includes(newVal.email.split(',')[0])) {
      inviteData.email = ''
      return
    }
    emailBadges.value.push(newVal.email.split(',')[0])
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
  if (!validateEmail(inviteData.email)) {
    emailValidation.isError = true
    emailValidation.message = 'invalid email'
    return
  }
  inviteData.email += ','
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
</script>

<template>
  <div class="my-2 pt-3 ml-2" data-testid="invite">
    <div class="text-xl mb-4">Invite</div>
    <div class="flex gap-2">
      <div class="flex flex-col">
        <div
          ref="divRef"
          class="flex w-130 border-1 gap-1 items-center rounded-lg nc-scrollbar-x-md flex-wrap max-h-30 overflow-y-scroll"
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
            class="text-[14px] border-1 text-brand-500 bg-brand-50 rounded-md ml-1 mt-1 p-0.5"
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
            class="min-w-50 !outline-0 !focus:outline-0 ml-2 mr-3 mt-1"
            data-testid="email-input"
            @keyup.enter="handleEnter"
            @blur="isDivFocused = false"
          />
        </div>
        <span v-if="emailValidation.isError" class="ml-2 text-red-500 text-[12px] mt-1">{{ emailValidation.message }}</span>
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
