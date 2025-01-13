<script lang="ts" setup>
import { ProjectRoles, type RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'

import { extractEmail } from '../../helpers/parsers/parserHelpers'

const props = defineProps<{
  modelValue: boolean
  type?: 'base' | 'workspace' | 'organization'
  baseId?: string
  emails?: string[]
  workspaceId?: string
}>()
const emit = defineEmits(['update:modelValue'])

const basesStore = useBases()

const workspaceStore = useWorkspace()

const { baseRoles, workspaceRoles } = useRoles()

const { createProjectUser } = basesStore

const { inviteCollaborator: inviteWsCollaborator } = workspaceStore

const dialogShow = useVModel(props, 'modelValue', emit)

const orderedRoles = computed(() => {
  return props.type === 'base' ? ProjectRoles : WorkspaceUserRoles
})
const userRoles = computed(() => {
  return props.type === 'base' ? baseRoles?.value : workspaceRoles?.value
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

const disabledRoles = ref<[]>([])

const isLoading = ref(false)

const organizationStore = useOrganization()

const { listWorkspaces } = organizationStore

const { workspaces } = storeToRefs(organizationStore)

const searchQuery = ref('')

const workSpaceSelectList = computed<WorkspaceType[]>(() => {
  return workspaces.value.filter((w: WorkspaceType) => w.title!.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const checked = reactive<{
  [key: string]: boolean
}>({})

const selectedWorkspaces = computed<WorkspaceType[]>(() => {
  return workSpaceSelectList.value.filter((ws: WorkspaceType) => checked[ws.id!])
})

const focusOnDiv = () => {
  focusRef.value?.focus()
  isDivFocused.value = true
}

const { t } = useI18n()

watch(dialogShow, async (newVal) => {
  if (newVal) {
    try {
      const rolesArr = Object.values(orderedRoles.value)
      const currentRoleIndex = rolesArr.findIndex((role) => userRoles.value && Object.keys(userRoles.value).includes(role))
      if (currentRoleIndex !== -1) {
        allowedRoles.value = rolesArr.slice(currentRoleIndex)
        disabledRoles.value = rolesArr.slice(0, currentRoleIndex)
      } else {
        allowedRoles.value = rolesArr
        disabledRoles.value = []
      }
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

const emailInputValidation = (input: string, isBulkEmailCopyPaste = false): boolean => {
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

const inviteCollaborator = async () => {
  try {
    isLoading.value = true
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
      for (const workspace of selectedWorkspaces.value) {
        await inviteWsCollaborator(payloadData, inviteData.roles, workspace.id)
      }
    }

    message.success(t('msg.info.inviteSent'))
    inviteData.email = ''
    emailBadges.value = []
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    singleEmailValue.value = ''
    isLoading.value = false
  }
}

const isOrgSelectMenuOpen = ref(false)

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
      <div class="flex flex-row text-2xl font-bold items-center gap-x-2">
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
              :disabled="isLoading"
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
            :disabled-roles="disabledRoles"
            :roles="allowedRoles"
            class="!min-w-[152px] nc-invite-role-selector"
            size="lg"
          />
        </div>

        <span v-if="emailValidation.isError && emailValidation.message" class="ml-2 text-red-500 text-[10px] mt-1.5">{{
          emailValidation.message
        }}</span>

        <template v-if="type === 'organization'">
          <NcDropdown v-model:visible="isOrgSelectMenuOpen">
            <NcButton class="!justify-between" full-width size="medium" type="secondary">
              <div
                :class="{
                  '!text-gray-600': selectedWorkspaces.length > 0,
                }"
                class="flex text-gray-500 justify-between items-center w-full"
              >
                <NcTooltip class="!max-w-130 truncate" show-on-truncate-only>
                  <span class="">
                    {{
                      selectedWorkspaces.length > 0
                        ? selectedWorkspaces.map((w) => w.title).join(', ')
                        : '-select workspaces to invite to-'
                    }}
                  </span>
                  <template #title>
                    {{
                      selectedWorkspaces.length > 0
                        ? selectedWorkspaces.map((w) => w.title).join(', ')
                        : '-select workspaces to invite to-'
                    }}
                  </template>
                </NcTooltip>

                <component :is="iconMap.chevronDown" />
              </div>
            </NcButton>
            <template #overlay>
              <div class="py-2">
                <div class="mx-2">
                  <a-input
                    v-model:value="searchQuery"
                    :class="{
                      '!border-brand-500': searchQuery.length > 0,
                    }"
                    class="!rounded-lg !h-8 !ring-0 !placeholder:text-gray-500 !border-gray-200 !px-4"
                    data-testid="nc-ws-search"
                    placeholder="Search workspace"
                  >
                    <template #prefix>
                      <component :is="iconMap.search" class="h-4 w-4 mr-1 text-gray-500" />
                    </template>
                  </a-input>
                </div>

                <div class="flex flex-col max-h-64 overflow-y-auto nc-scrollbar-md mt-2 px-2">
                  <div
                    v-for="ws in workSpaceSelectList"
                    :key="ws.id"
                    class="px-2 cursor-pointer hover:bg-gray-100 rounded-lg h-9.5 py-2 w-full flex gap-2"
                    @click="checked[ws.id!] = !checked[ws.id!]"
                  >
                    <div class="flex gap-2 capitalize items-center">
                      <GeneralWorkspaceIcon :workspace="ws" size="medium" />
                      {{ ws.title }}
                    </div>
                    <div class="flex-1" />
                    <NcCheckbox v-model:checked="checked[ws.id!]" size="large" />
                  </div>
                </div>
              </div>
            </template>
            />
          </NcDropdown>
        </template>
      </div>
    </div>
    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="dialogShow = false"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
          :disabled="isInviteButtonDisabled || emailValidation.isError || isLoading"
          :loading="isLoading"
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
