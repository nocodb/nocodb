<script lang="ts" setup>
import {
  NON_SEAT_ROLES,
  NcErrorType,
  type PlanLimitExceededDetailsType,
  ProjectRoles,
  type RoleLabels,
  type TeamV3V3Type,
  type UserType,
  type WorkspaceType,
  WorkspaceUserRoles,
} from 'nocodb-sdk'

import { extractEmail } from '../../helpers/parsers/parserHelpers'

const props = defineProps<{
  modelValue: boolean
  type?: 'base' | 'workspace' | 'organization'
  isTeam?: boolean
  baseId?: string
  emails?: string[]
  workspaceId?: string
  users?: Array<Pick<UserType, 'email'>>
  teams?: Array<TeamV3V3Type>
  existingTeamIds?: string[]
}>()
const emit = defineEmits(['update:modelValue'])

const basesStore = useBases()

const { appInfo } = useGlobal()

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { baseRoles, workspaceRoles } = useRoles()

const { createProjectUser, baseTeamAdd } = basesStore

const { inviteCollaborator: inviteWsCollaborator, workspaceTeamAdd } = workspaceStore

const { isTeamsEnabled } = storeToRefs(workspaceStore)

const { isPaymentEnabled, showUserPlanLimitExceededModal, isPaidPlan, showUserMayChargeAlert } = useEeConfig()

const dialogShow = useVModel(props, 'modelValue', emit)

const orderedRoles = computed(() => {
  return props.type === 'base' ? ProjectRoles : WorkspaceUserRoles
})

const userRoles = computed(() => {
  return props.type === 'base' ? baseRoles?.value : workspaceRoles?.value
})

const inviteData = reactive({
  email: '',
  selectedTeamIds: [],
  roles: orderedRoles.value.NO_ACCESS,
})

const warningMsg = ref<string>()

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

const disabledRolesTooltip = computed<Record<keyof typeof RoleLabels, string>>(() => {
  if (!props.isTeam) return {}

  return {
    [WorkspaceUserRoles.OWNER]: t('objects.teams.teamCantBeAssignedOwnerRole'),
    [ProjectRoles.OWNER]: t('objects.teams.teamCantBeAssignedOwnerRole'),
  } as Record<keyof typeof RoleLabels, string>
})

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

watch(dialogShow, async (newVal) => {
  if (newVal) {
    try {
      const rolesArr = Object.values(orderedRoles.value)
      let currentRoleIndex = rolesArr.findIndex((role) => userRoles.value && Object.keys(userRoles.value).includes(role))

      if (currentRoleIndex !== -1) {
        // We don't allow user to assign owner role to a team
        if (props.isTeam && currentRoleIndex === 0) {
          currentRoleIndex = 1
        }

        let filteredRoles = rolesArr

        // If teams are not enabled, filter out INHERIT role as well
        // todo: remove this check once teams are enabled by default
        if (props.isTeam || !isTeamsEnabled.value) {
          filteredRoles = rolesArr.filter((role) => role !== WorkspaceUserRoles.INHERIT && role !== ProjectRoles.INHERIT)
        }

        allowedRoles.value = filteredRoles.slice(currentRoleIndex)
        disabledRoles.value = filteredRoles.slice(0, currentRoleIndex)
      } else {
        // Filter out INHERIT role for teams (workspace or base teams)
        let filteredRoles = rolesArr
        if (props.isTeam) {
          filteredRoles = rolesArr.filter((role) => role !== WorkspaceUserRoles.INHERIT && role !== ProjectRoles.INHERIT)
          allowedRoles.value = filteredRoles.slice(1)
          disabledRoles.value = filteredRoles.slice(0, 1)
        } else {
          allowedRoles.value = rolesArr
          disabledRoles.value = []
        }
      }
      // move INHERIT role to the end of the list, if present in allowed roles
      let inheritIndex = allowedRoles.value.indexOf(WorkspaceUserRoles.INHERIT)
      inheritIndex = inheritIndex === -1 ? allowedRoles.value.indexOf(ProjectRoles.INHERIT) : inheritIndex
      if (inheritIndex !== -1) {
        allowedRoles.value.push(...allowedRoles.value.splice(inheritIndex, 1))
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }

    if (props.emails) {
      emailBadges.value = props.emails
    }

    if (props.isTeam) {
      emailValidation.isError = false
    }

    setTimeout(() => {
      focusOnDiv()
    }, 100)
  } else {
    emailBadges.value = []
    inviteData.email = ''
    inviteData.roles = orderedRoles.value.NO_ACCESS
    singleEmailValue.value = ''
    inviteData.selectedTeamIds = []
    warningMsg.value = ''
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
  if (props.isTeam) {
    return !inviteData.selectedTeamIds?.length
  }

  if (!emailBadges.value.length && !singleEmailValue.value.length) {
    return true
  }
  if (emailBadges.value.length && inviteData.email) {
    return true
  }
})

const showUserWillChargedWarning = computed(() => {
  return (
    isEeUI &&
    !appInfo.value?.isOnPrem &&
    isPaymentEnabled.value &&
    isPaidPlan.value &&
    !NON_SEAT_ROLES.includes(inviteData.roles) &&
    showUserMayChargeAlert.value &&
    !isInviteButtonDisabled.value &&
    !emailValidation.isError
  )
})

watch(inviteData, (newVal) => {
  if (props.isTeam) {
    return
  }

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
     if email is already entered we delete the already
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
  if (props.isTeam) return

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

  // if data is pasted to an already existing text in input
  // we add existingInput + pasted data
  if (inputArray?.length === 1 && inviteData.email.length) {
    inputArray[0] = inviteData.email += inputArray[0]
  }

  inputArray?.forEach((el) => {
    el = extractEmail(el) || el

    const isEmailIsValid = emailInputValidation(el, inputArray.length > 1)

    if (!isEmailIsValid) return

    /**
     if email is already entered we delete the already
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

    if (!props.isTeam) {
      const payloadData = singleEmailValue.value || emailBadges.value.join(',')
      if (!payloadData.includes(',')) {
        const validationStatus = validateEmail(payloadData)
        if (!validationStatus) {
          emailValidation.isError = true
          emailValidation.message = 'invalid email'
        }
      }

      for (const email of payloadData?.split(',')) {
        if (props.users?.some((u) => u.email === email.trim())) {
          let scopeLabel = 'objects.project'

          if (props.type === 'workspace') {
            scopeLabel = 'objects.workspace'
          } else if (props.type === 'organization') {
            scopeLabel = 'general.organization'
          }

          warningMsg.value = t('msg.userAlreadyExists', { email: email.trim(), scope: t(scopeLabel).toLowerCase() })
          return
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
    } else {
      if (props.type === 'base' && props.baseId) {
        await baseTeamAdd(
          props.baseId!,
          inviteData.selectedTeamIds.map((teamId) => ({
            team_id: teamId,
            base_role: inviteData.roles as Exclude<ProjectRoles, ProjectRoles.OWNER>,
          })),
        )
      } else if (props.type === 'workspace' && props.workspaceId) {
        await workspaceTeamAdd(
          props.workspaceId,
          inviteData.selectedTeamIds.map((teamId) => ({
            team_id: teamId,
            workspace_role: inviteData.roles as Exclude<WorkspaceUserRoles, WorkspaceUserRoles.OWNER>,
          })),
        )
      }
    }
    dialogShow.value = false
  } catch (e: any) {
    const errorInfo = await extractSdkResponseErrorMsgv2(e)

    if (isPaymentEnabled.value && errorInfo.error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) {
      let errorWsId
      if (props.type === 'workspace' && props.workspaceId) {
        errorWsId = props.workspaceId
      } else if (props.type === 'organization') {
        // We have to extract ws id from request url as we are making multple api calls
        errorWsId = e?.config?.url?.split('/')?.[4]
      }

      const details = errorInfo.details as PlanLimitExceededDetailsType

      showUserPlanLimitExceededModal({
        details,
        role: inviteData.roles,
        callback(type) {
          if (type === 'ok') {
            dialogShow.value = false
          }
        },
        workspaceId: errorWsId,
        isAdminPanel: props.type === 'organization',
      })
    } else {
      if (errorInfo.error === NcErrorType.ERR_UNKNOWN) {
        errorInfo.message = await extractSdkResponseErrorMsg(e)
      }
      message.error(errorInfo.message)
    }
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

const removeEmail = (index: number) => {
  warningMsg.value = null
  emailBadges.value.splice(index, 1)
  if (emailBadges.value.length === 0) {
    inviteData.email = ''
  }
}

const onTeamChange = async (_teamIds: RawValueType) => {
  inviteData.selectedTeamIds = (_teamIds as string[]) ?? []
}
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
            ? 'Invite Members to Workspaces'
            : type === 'base'
            ? isTeam
              ? $t('activity.addTeamsToBase')
              : $t('activity.addMember')
            : isTeam
            ? $t('activity.addTeamsToWorkspace')
            : $t('activity.inviteToWorkspace')
        }}
      </div>
    </template>
    <div class="flex items-center justify-between gap-3 mt-2">
      <div class="flex w-full gap-4 flex-col">
        <div class="flex flex-col gap-6 md:(flex-row gap-3 justify-between) w-full">
          <div
            v-if="!isTeam"
            ref="divRef"
            :class="{
              'border-primary/100 shadow-selected': isDivFocused,
              'p-1': emailBadges?.length > 0,
            }"
            class="flex items-center flex-wrap border-1 gap-1 w-full overflow-x-scroll nc-scrollbar-x-md min-h-10 rounded-lg md:!min-w-96"
            tabindex="0"
            @blur="isDivFocused = false"
            @click="focusOnDiv"
          >
            <span
              v-for="(email, index) in emailBadges"
              :key="email"
              class="border-1 text-nc-content-gray bg-nc-bg-gray-light rounded-md flex items-center px-1 whitespace-nowrap"
            >
              {{ email }}
              <component
                :is="iconMap.close"
                class="ml-0.5 hover:(cursor-pointer text-nc-content-gray-subtle) mt-0.5 w-4 h-4 text-nc-content-gray-subtle2"
                @click="removeEmail(index)"
              />
            </span>
            <input
              id="email"
              ref="focusRef"
              v-model="inviteData.email"
              inputmode="email"
              :disabled="isLoading"
              :placeholder="$t('activity.enterEmail')"
              class="flex-1 md:min-w-36 outline-none px-2"
              data-testid="email-input"
              @blur="isDivFocused = false"
              @keyup.enter="handleEnter"
              @paste.prevent="onPaste"
              @input="warningMsg = null"
            />
          </div>
          <NcListTeamSelector
            v-else
            :on-change="onTeamChange"
            :value="inviteData.selectedTeamIds || []"
            is-multi-select
            :teams="teams"
            :existing-team-ids="existingTeamIds"
            class="!min-w-[152px] nc-add-team-selector"
            size="lg"
            placement="bottomLeft"
          />

          <div class="flex items-center justify-between gap-4">
            <div class="md:hidden text-nc-content-gray text-bodyLg">{{ $t('labels.selectRole') }}:</div>
            <div class="flex items-center">
              <RolesSelectorV2
                :on-role-change="onRoleChange"
                :role="inviteData.roles"
                :disabled-roles="disabledRoles"
                :disabled-roles-tooltip="disabledRolesTooltip"
                :roles="allowedRoles"
                class="!min-w-[152px] nc-invite-role-selector"
                size="lg"
                placement="bottomRight"
              />
            </div>
          </div>
        </div>
        <!-- show warning if validation fails and warningMsg defined -->
        <span v-if="warningMsg" class="ml-2 text-nc-content-red-medium -mt-2">{{ warningMsg }}</span>

        <span v-if="emailValidation.isError && emailValidation.message" class="ml-2 text-nc-content-red-medium -mt-2">{{
          emailValidation.message
        }}</span>

        <template v-if="type === 'organization'">
          <NcDropdown v-model:visible="isOrgSelectMenuOpen">
            <NcButton class="!justify-between" full-width size="medium" type="secondary">
              <div
                :class="{
                  '!text-nc-content-gray-subtle2': selectedWorkspaces.length > 0,
                }"
                class="flex text-nc-content-gray-muted justify-between items-center w-full"
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
                      '!border-nc-border-brand': searchQuery.length > 0,
                    }"
                    class="!rounded-lg !h-8 !ring-0 !placeholder:text-nc-content-gray-muted !border-nc-border-gray-medium !px-4"
                    data-testid="nc-ws-search"
                    placeholder="Search workspace"
                  >
                    <template #prefix>
                      <component :is="iconMap.search" class="h-4 w-4 mr-1 text-nc-content-gray-muted" />
                    </template>
                  </a-input>
                </div>

                <div class="flex flex-col max-h-64 overflow-y-auto nc-scrollbar-md mt-2 px-2">
                  <div
                    v-for="ws in workSpaceSelectList"
                    :key="ws.id"
                    class="px-2 cursor-pointer hover:bg-nc-bg-gray-light rounded-lg h-9.5 py-2 w-full flex gap-2"
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

    <NcAlert
      :visible="showUserWillChargedWarning"
      type="warning"
      :message="$t('upgrade.newEditorWillBeChanged')"
      :description="$t('upgrade.newEditorWillBeChangedSubtitle')"
      class="mt-5"
    />

    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="dialogShow = false"> {{ $t('labels.cancel') }}</NcButton>
        <NcButton
          :disabled="isInviteButtonDisabled || emailValidation.isError || isLoading || !!warningMsg"
          :loading="isLoading"
          size="medium"
          type="primary"
          class="nc-invite-btn"
          @click="inviteCollaborator"
        >
          {{
            isTeam
              ? (inviteData.selectedTeamIds || []).length > 1
                ? $t('labels.addTeams')
                : $t('labels.addTeam')
              : type === 'base'
              ? $t('activity.inviteToBase')
              : $t('activity.inviteToWorkspace')
          }}
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
