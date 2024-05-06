<script lang="ts" setup>
import { ProjectRoles, type RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'
import type { User } from '#imports'

import { extractEmail } from '~/helpers/parsers/parserHelpers'

const props = defineProps<{
  modelValue: boolean
  type?: 'base' | 'workspace' | 'organization'
  baseId?: string
  emails?: string[]
  workspaceId?: string
}>()
const emit = defineEmits(['update:modelValue'])

const { baseRoles, workspaceRoles } = useRoles()

const basesStore = useBases()

const workspaceStore = useWorkspace()

const { createProjectUser } = basesStore

const { inviteCollaborator: inviteWsCollaborator } = workspaceStore

const dialogShow = useVModel(props, 'modelValue', emit)

const orderedRoles = computed(() => {
  return props.type === 'base' ? ProjectRoles : WorkspaceUserRoles
})

const userRoles = computed(() => {
  return props.type === 'base' ? baseRoles.value : workspaceRoles.value
})

const inviteData = reactive({
  email: '',
  roles: orderedRoles.value.NO_ACCESS,
})

const divRef = ref<HTMLDivElement>()

const focusRef = ref<HTMLInputElement>()
const isDivFocused = ref(false)

const emailValidation = reactive({
  isError: true,
  message: '',
})

const singleEmailValue = ref('')

const emailBadges = ref<Array<string>>([])

const allowedRoles = ref<[]>([])

const focusOnDiv = () => {
  focusRef.value?.focus()
  isDivFocused.value = true
}

watch(dialogShow, async (newVal) => {
  if (newVal) {
    try {
      // todo: enable after discussing with anbu
      // const currentRoleIndex = Object.values(orderedRoles.value).findIndex(
      //   (role) => userRoles.value && Object.keys(userRoles.value).includes(role),
      // )
      // if (currentRoleIndex !== -1) {
      allowedRoles.value = Object.values(orderedRoles.value) // .slice(currentRoleIndex + 1)
      // }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }

    if (props.emails) {
      emailBadges.value = props.emails
    }

    setTimeout(() => {
      focusOnDiv()
    }, 100)
  } else {
    emailBadges.value = []
    inviteData.email = ''
    singleEmailValue.value = ''
  }
})

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

const emailInputValidation = (input: string, isBulkEmailCopyPaste: boolean = false): boolean => {
  if (!input.length) {
    if (isBulkEmailCopyPaste) return false

    emailValidation.isError = true
    emailValidation.message = 'Email should not be empty'
    return false
  }
  if (!validateEmail(input.trim())) {
    if (isBulkEmailCopyPaste) return false

    emailValidation.isError = true
    emailValidation.message = 'Invalid Email'
    return false
  }
  return true
}

const isInviteButtonDisabled = computed(() => {
  if (!emailBadges.value.length && !singleEmailValue.value.length) {
    return true
  }
  if (emailBadges.value.length && inviteData.email) {
    return true
  }
})

watch(inviteData, (newVal) => {
  // when user only want to enter a single email
  // we don't convert that as badge

  const isSingleEmailValid = validateEmail(newVal.email)
  if (isSingleEmailValid && !emailBadges.value.length) {
    singleEmailValue.value = newVal.email
    emailValidation.isError = false
    return
  }
  singleEmailValue.value = ''

  // when user enters multiple emails comma separated or space separated
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
// remove one email per backspace
onKeyStroke('Backspace', () => {
  if (isDivFocused.value && inviteData.email.length < 1) {
    emailBadges.value.pop()
  }
})

watch(dialogShow, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      focusOnDiv()
    }, 100)
  }
})

// when bulk email is pasted
const onPaste = (e: ClipboardEvent) => {
  emailValidation.isError = false

  const pastedText = e.clipboardData?.getData('text')

  const inputArray = pastedText?.split(',') || pastedText?.split(' ')

  // if data is pasted to a already existing text in input
  // we add existingInput + pasted data
  if (inputArray?.length === 1 && inviteData.email.length) {
    inputArray[0] = inviteData.email += inputArray[0]
  }

  inputArray?.forEach((el) => {
    el = extractEmail(el) || el

    const isEmailIsValid = emailInputValidation(el, inputArray.length > 1)

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

const workSpaces = ref<NcWorkspace[]>([])

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
    if (props.type === 'base' && props.baseId) {
      await createProjectUser(props.baseId!, {
        email: payloadData,
        roles: inviteData.roles,
      } as unknown as User)
    } else if (props.type === 'workspace' && props.workspaceId) {
      await inviteWsCollaborator(payloadData, inviteData.roles, props.workspaceId)
    } else if (props.type === 'organization') {
      // TODO: Add support for Bulk Workspace Invite
      for (const workspace of workSpaces.value) {
        await inviteWsCollaborator(payloadData, inviteData.roles, workspace.id)
      }
    }

    message.success('Invitation sent successfully')
    inviteData.email = ''
    emailBadges.value = []
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    singleEmailValue.value = ''
  }
}

const organizationStore = useOrganization()

const { listWorkspaces } = organizationStore

const { workspaces } = storeToRefs(organizationStore)

const workSpaceSelectList = computed(() => {
  return workspaces.value.filter((w) => !workSpaces.value.find((ws) => ws.id === w.id))
})

const addToList = (workspaceId: string) => {
  workSpaces.value.push(workspaces.value.find((w) => w.id === workspaceId)!)
}
const removeWorkspace = (workspaceId: string) => {
  workSpaces.value = workSpaces.value.filter((w) => w.id !== workspaceId)
}

onMounted(async () => {
  if (props.type === 'organization') {
    await listWorkspaces()
  }
})

const onRoleChange = (role: keyof typeof RoleLabels) => (inviteData.roles = role as ProjectRoles | WorkspaceUserRoles)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createTable')"
    :show-separator="false"
    size="medium"
    class="nc-invite-dlg"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        {{
          type === 'organization'
            ? $t('labels.addMembersToOrganization')
            : type === 'base'
            ? $t('activity.addMember')
            : $t('activity.inviteToWorkspace')
        }}
      </div>
    </template>
    <div class="flex items-center justify-between gap-3 mt-2">
      <div class="flex w-full gap-4 flex-col">
        <div class="flex justify-between gap-3 w-full">
          <div
            ref="divRef"
            :class="{
              'border-primary/100': isDivFocused,
              'p-1': emailBadges?.length > 1,
            }"
            class="flex items-center border-1 gap-1 w-full overflow-x-scroll nc-scrollbar-x-md items-center h-10 rounded-lg !min-w-96"
            tabindex="0"
            @blur="isDivFocused = false"
            @click="focusOnDiv"
          >
            <span
              v-for="(email, index) in emailBadges"
              :key="email"
              class="border-1 text-gray-800 first:ml-1 bg-gray-100 rounded-md flex items-center px-2 py-1"
            >
              {{ email }}
              <component
                :is="iconMap.close"
                class="ml-0.5 hover:cursor-pointer mt-0.5 w-4 h-4"
                @click="emailBadges.splice(index, 1)"
              />
            </span>
            <input
              id="email"
              ref="focusRef"
              v-model="inviteData.email"
              :placeholder="$t('activity.enterEmail')"
              class="w-full min-w-36 outline-none px-2"
              data-testid="email-input"
              @blur="isDivFocused = false"
              @keyup.enter="handleEnter"
              @paste.prevent="onPaste"
            />
          </div>
          <RolesSelector
            :description="false"
            :on-role-change="onRoleChange"
            :role="inviteData.roles"
            :roles="allowedRoles"
            class="!min-w-[152px] nc-invite-role-selector"
            size="lg"
          />
        </div>

        <span v-if="emailValidation.isError && emailValidation.message" class="ml-2 text-red-500 text-[10px] mt-1.5">{{
          emailValidation.message
        }}</span>

        <template v-if="type === 'organization'">
          <NcSelect :placeholder="$t('labels.selectWorkspace')" size="middle" @change="addToList">
            <a-select-option v-for="workspace in workSpaceSelectList" :key="workspace.id" :value="workspace.id">
              {{ workspace.title }}
            </a-select-option>
          </NcSelect>

          <div class="flex flex-wrap gap-2">
            <NcBadge v-for="workspace in workSpaces" :key="workspace.id">
              <div class="px-2 flex gap-2 items-center py-1">
                <GeneralWorkspaceIcon :workspace="workspace" hide-label size="small" />
                <span class="text-gray-600">
                  {{ workspace.title }}
                </span>
                <component :is="iconMap.close" class="w-3 h-3" @click="removeWorkspace(workspace.id)" />
              </div>
            </NcBadge>
          </div>
        </template>
      </div>
    </div>
    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="dialogShow = false"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
          :disabled="isInviteButtonDisabled || emailValidation.isError"
          size="medium"
          type="primary"
          class="nc-invite-btn"
          @click="inviteCollaborator"
        >
          {{ type === 'base' ? $t('activity.inviteToBase') : $t('activity.inviteToWorkspace') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
:deep(.nc-invite-role-selector .nc-role-badge) {
  @apply w-full;
}
</style>
