<script lang="ts" setup>
import {
  NON_SEAT_ROLES,
  NcErrorType,
  type OrgUserListItemType,
  type PlanLimitExceededDetailsType,
  ProjectRoles,
  RoleLabels,
  type TeamV3V3Type,
  type UserType,
  type WorkspaceType,
  WorkspaceUserRoles,
} from 'nocodb-sdk'

import { extractEmail } from '../../../helpers/parsers/parserHelpers'

const props = withDefaults(
  defineProps<{
    /**
     * Whether this form is on screen; the dialog being open, or its tab being
     * the selected one. Drives the same reset/prefetch the dialog used to hang
     * off its own visibility flag.
     */
    active: boolean
    type?: 'base' | 'workspace' | 'organization'
    isTeam?: boolean
    baseId?: string
    emails?: string[]
    workspaceId?: string
    users?: Array<Pick<UserType, 'email'>>
    teams?: Array<TeamV3V3Type>
    existingTeamIds?: string[]
    /**
     * `stacked` is the long-standing look: labelled field, role as a detail block.
     * `compose` is the share hub's screen: no field label, role as a form control.
     * Base settings and workspace home stay on `stacked`.
     */
    layout?: 'stacked' | 'compose'
    /** Hosts that draw their own footer pass false and drive it through `submit`. */
    showFooter?: boolean
    submitLabel?: string
  }>(),
  {
    layout: 'stacked',
    showFooter: true,
  },
)

const emit = defineEmits(['close', 'success'])

const isCompose = computed(() => props.layout === 'compose')

const basesStore = useBases()

const { appInfo } = useGlobal()

const { t } = useI18n()

const { $e } = useNuxtApp()

const workspaceStore = useWorkspace()

const { baseRoles, workspaceRoles } = useRoles()

const { createProjectUser, baseTeamAdd } = basesStore

const { inviteCollaborator: inviteWsCollaborator, workspaceTeamAdd } = workspaceStore

const { isTeamsEnabled } = storeToRefs(workspaceStore)

const { fetchOrgUsers, resetOrgUsers, orgUsers } = useOrgUserInvitePicker({
  type: props.type,
  workspaceId: props.workspaceId,
  baseId: props.baseId,
})

const { isPaymentEnabled, showUserPlanLimitExceededModal, isPaidPlan, showUserMayChargeAlert } = useEeConfig()

const dialogShow = computed(() => props.active)

const orderedRoles = computed(() => {
  return props.type === 'base' ? ProjectRoles : WorkspaceUserRoles
})

const userRoles = computed(() => {
  return props.type === 'base' ? baseRoles?.value : workspaceRoles?.value
})

// Editor, not No Access: inviting someone is an act of granting access, so the
// default should be the role that lets them do the thing they were invited for.
// Both enums (ProjectRoles / WorkspaceUserRoles) define EDITOR.
const inviteData = reactive({
  email: '',
  selectedTeamIds: [],
  roles: orderedRoles.value.EDITOR,
})

/** What the submit button says unless the host overrides it. */
const defaultSubmitLabel = computed(() => {
  if (props.isTeam) {
    return (inviteData.selectedTeamIds || []).length > 1 ? t('labels.addTeams') : t('labels.addTeam')
  }

  return props.type === 'base' ? t('activity.inviteToBase') : t('activity.inviteToWorkspace')
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

watch(
  dialogShow,
  async (newVal) => {
    if (newVal) {
      try {
        let rolesArr = Object.values(orderedRoles.value)

        // App User is a per-person external status; not assignable to a team, and
        // only surfaced in EE (CE has no app feature, so hide it there too).
        if (props.isTeam || !isEeUI) rolesArr = rolesArr.filter((role) => role !== ProjectRoles.APP_USER)

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

            // Recompute index against filteredRoles since removing INHERIT shifts positions
            currentRoleIndex = filteredRoles.findIndex((role) => userRoles.value && Object.keys(userRoles.value).includes(role))
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
            // Roles unknown at this point -- `workspaceRoles` is null until
            // `user.workspace_roles` lands, and this watch is immediate, so it
            // can run before then. Never offer Owner on a guess: the server
            // refuses it for every caller anyway, and the team branch above
            // already withholds it for the same reason.
            allowedRoles.value = filteredRoles.slice(1)
            disabledRoles.value = filteredRoles.slice(0, 1)
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
      inviteData.roles = orderedRoles.value.EDITOR
      singleEmailValue.value = ''
      inviteData.selectedTeamIds = []
      warningMsg.value = ''
    }
  },
  // This form is the modal *body*, and NcModal defaults to destroyOnClose, so it
  // mounts with `active` already true and a change-only watch never runs -- which
  // left the role list empty and Add Team permanently disabled. Same reason the
  // org-user watch below is immediate.
  { immediate: true },
)

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

/** What is typed but not yet turned into a chip. */
const pendingEmail = computed(() => inviteData.email.trim())

/**
 * Chips, plus the typed-but-unchipped address once it is a complete one.
 * A half-typed address does not hold the finished ones hostage.
 */
const validRecipients = computed(() => {
  const list = [...emailBadges.value]
  const pending = pendingEmail.value

  if (pending && validateEmail(pending) && !list.includes(pending)) list.push(pending)

  return list
})

/** Text still in the box that is not a sendable address yet. */
const unsentEmail = computed(() => (pendingEmail.value && !validateEmail(pendingEmail.value) ? pendingEmail.value : ''))

const isInviteButtonDisabled = computed(() => {
  if (props.isTeam) {
    return !inviteData.selectedTeamIds?.length
  }

  return !validRecipients.value.length
})

/** Reads back as a sentence, so the role name agrees with the number of people. */
const roleCopy = (count: number) => {
  const key = RoleLabels[inviteData.roles] ?? inviteData.roles
  const group = count > 1 ? 'roleTypePlural' : 'roleType'

  return {
    label: t(`objects.${group}.${key}`, inviteData.roles),
    can: t(`objects.roleDescription.${inviteData.roles}`).toLowerCase(),
  }
}

/**
 * Says what pressing the button will do, and why it cannot yet when something is
 * still half-typed. Falls back to the bulk-paste hint on an empty field.
 */
const fieldHint = computed(() => {
  if (unsentEmail.value) return t('msg.info.keepTypingFullEmail')

  const count = validRecipients.value.length
  if (!count) return t('msg.info.inviteEmailBulkHint')

  // vue-i18n's `t(key, plural, opts)` overload treats the third argument as
  // options, not named values, so only `count` would survive. Named-then-plural
  // is the overload that carries `role` and `can` through.
  const role = roleCopy(count)

  return t('msg.info.willJoinAsRole', { count, role: role.label, can: role.can }, count)
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
  const invited: string[] = []

  try {
    isLoading.value = true

    if (!props.isTeam) {
      // Send the addresses that are ready; whatever is still half-typed stays
      // in the box afterwards so it can be finished rather than retyped.
      const recipients = validRecipients.value
      const leftover = unsentEmail.value

      if (!recipients.length) {
        emailValidation.isError = true
        emailValidation.message = 'Invalid Email'
        return
      }

      const payloadData = recipients.join(',')

      for (const email of recipients) {
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
      invited.push(...recipients)
      emailBadges.value = []
      inviteData.email = leftover
      singleEmailValue.value = ''
      emailValidation.isError = false
      emailValidation.message = ''

      // Something is still waiting to be corrected, so the form stays open.
      if (leftover) {
        emit('success', invited)
        return
      }
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

    emit('success', invited)
    emit('close')
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
            emit('close')
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

// Org-user invite picker: shows org members not already in the workspace/base
// as the user types, so they can be added without typing the email out.

const pickerSelectedIndex = ref(0)

// Suppress the dropdown until the user actually clicks the input or types.
// Without this, the dialog's auto-focus on open would surface the picker
// immediately, which is jarring.
const hasUserInteracted = ref(false)

const filteredOrgUsers = computed<OrgUserListItemType[]>(() => {
  const q = inviteData.email.trim().toLowerCase()
  const selected = new Set<string>(emailBadges.value.map((e) => e.toLowerCase()))
  if (singleEmailValue.value) selected.add(singleEmailValue.value.toLowerCase())

  const pool = orgUsers.value.filter((u) => u.email && !selected.has(u.email.toLowerCase()))

  const matches = q
    ? pool.filter((u) => u.email.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q))
    : pool

  return matches.slice(0, 8)
})

const isOrgUserPickerVisible = computed(
  () =>
    isEeUI &&
    !props.isTeam &&
    (props.type === 'workspace' || props.type === 'base') &&
    hasUserInteracted.value &&
    isDivFocused.value &&
    filteredOrgUsers.value.length > 0,
)

const selectOrgUser = (user: OrgUserListItemType) => {
  if (!user?.email) return

  if (!emailBadges.value.includes(user.email)) {
    emailBadges.value.push(user.email)
  }

  inviteData.email = ''
  singleEmailValue.value = ''
  emailValidation.isError = false
  emailValidation.message = ''
  pickerSelectedIndex.value = 0

  $e(props.type === 'base' ? 'c:base:invite:org-user-select' : 'c:workspace:invite:org-user-select', {
    count: 1,
  })

  nextTick(() => focusRef.value?.focus())
}

const onPickerArrowDown = (e: KeyboardEvent) => {
  if (!isOrgUserPickerVisible.value) return
  e.preventDefault()
  pickerSelectedIndex.value = Math.min(pickerSelectedIndex.value + 1, filteredOrgUsers.value.length - 1)
}

const onPickerArrowUp = (e: KeyboardEvent) => {
  if (!isOrgUserPickerVisible.value) return
  e.preventDefault()
  pickerSelectedIndex.value = Math.max(pickerSelectedIndex.value - 1, 0)
}

const onInputEnter = (e: KeyboardEvent) => {
  if (isOrgUserPickerVisible.value) {
    const picked = filteredOrgUsers.value[pickerSelectedIndex.value]
    if (picked) {
      e.preventDefault()
      selectOrgUser(picked)
      return
    }
  }
  handleEnter()
}

watch(
  () => inviteData.email,
  () => {
    pickerSelectedIndex.value = 0
  },
)

watch(
  dialogShow,
  async (v) => {
    if (v) {
      hasUserInteracted.value = false
      await fetchOrgUsers()
    } else {
      resetOrgUsers()
      hasUserInteracted.value = false
    }
  },
  // a tab host can mount already-active, which a change-only watch would miss
  { immediate: true },
)

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

/** How many people the submit would actually invite, for a host that labels its own button. */
const recipientCount = computed(() => (props.isTeam ? (inviteData.selectedTeamIds || []).length : validRecipients.value.length))

/** For hosts that draw their own footer (`show-footer="false"`). */
const canSubmit = computed(() => !isInviteButtonDisabled.value && !isLoading.value && !warningMsg.value)

defineExpose({
  focus: focusOnDiv,
  submit: inviteCollaborator,
  canSubmit,
  isLoading,
  defaultSubmitLabel,
  recipientCount,
})
</script>

<template>
  <div class="nc-invite-form">
    <div class="flex items-center justify-between gap-3" :class="isCompose ? '' : 'mt-2'">
      <div class="flex w-full gap-4 flex-col">
        <div class="flex flex-col gap-4 w-full">
          <div v-if="!isTeam" class="relative w-full flex flex-col gap-1.5">
            <span v-if="!isCompose" class="nc-invite-field-label">{{ $t('labels.emailAddresses') }}</span>
            <div
              ref="divRef"
              :class="{
                'p-1 items-start content-start': emailBadges?.length > 0,
                'items-center content-center': !emailBadges?.length,
              }"
              class="nc-invite-email-box flex flex-wrap border-1 gap-1 w-full min-h-10 max-h-[176px] overflow-y-auto nc-scrollbar-thin rounded-lg"
              tabindex="0"
              @blur="isDivFocused = false"
              @click="focusOnDiv"
            >
              <TransitionGroup name="nc-invite-chip">
                <span
                  v-for="(email, index) in emailBadges"
                  :key="email"
                  class="nc-invite-chip border-1 border-nc-border-brand-medium text-nc-content-brand bg-nc-bg-brand rounded-md flex items-center px-1 max-w-full"
                >
                  <NcTooltip class="truncate" show-on-truncate-only>
                    <template #title>{{ email }}</template>
                    {{ email }}
                  </NcTooltip>
                  <component
                    :is="iconMap.close"
                    class="nc-invite-chip-close ml-0.5 hover:cursor-pointer mt-0.5 w-4 h-4 text-nc-content-brand"
                    @click="removeEmail(index)"
                  />
                </span>
              </TransitionGroup>
              <input
                id="email"
                ref="focusRef"
                v-model="inviteData.email"
                inputmode="email"
                :disabled="isLoading"
                :placeholder="$t('activity.inviteEmailExample')"
                class="flex-1 md:min-w-36 outline-none px-2"
                :class="{ 'basis-full': emailBadges?.length > 0 }"
                data-testid="email-input"
                @blur="isDivFocused = false"
                @click="hasUserInteracted = true"
                @keydown.down="onPickerArrowDown"
                @keydown.up="onPickerArrowUp"
                @keydown.enter="onInputEnter"
                @paste.prevent="onPaste"
                @input="
                  () => {
                    hasUserInteracted = true
                    warningMsg = null
                  }
                "
              />
            </div>

            <span class="nc-invite-field-hint">{{ fieldHint }}</span>

            <div
              v-if="isOrgUserPickerVisible"
              class="nc-invite-org-user-picker absolute z-50 left-0 right-0 top-full mt-1 p-1 bg-white dark:bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-lg shadow-md max-h-64 overflow-y-auto nc-scrollbar-thin"
              data-testid="nc-invite-org-user-picker"
              @mousedown.prevent
            >
              <div
                v-for="(orgUser, i) in filteredOrgUsers"
                :key="orgUser.id"
                :class="{ 'bg-nc-bg-gray-light': i === pickerSelectedIndex }"
                class="px-3 py-2 cursor-pointer rounded-md hover:bg-nc-bg-gray-light"
                :data-testid="`nc-invite-org-user-${orgUser.email}`"
                @click="selectOrgUser(orgUser)"
                @mouseenter="pickerSelectedIndex = i"
              >
                <NcUserInfo :user="(orgUser as any)" />
              </div>
            </div>
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

          <!-- Its own block, label above: side by side, the control stayed pinned to
               the top while the email field grew taller beside it. -->
          <div class="flex flex-col gap-1.5 w-full">
            <span :class="isCompose ? 'nc-invite-field-strong' : 'nc-invite-field-label'">{{ $t('labels.inviteAs') }}</span>
            <RolesSelectorV2
              :on-role-change="onRoleChange"
              :role="inviteData.roles"
              :disabled-roles="disabledRoles"
              :disabled-roles-tooltip="disabledRolesTooltip"
              :roles="allowedRoles"
              :trigger-variant="isCompose ? 'field' : 'detail'"
              class="nc-invite-role-selector"
              :class="{ '-ml-1.5': !isCompose }"
              size="lg"
              placement="bottomLeft"
            />
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

    <div v-if="showFooter" class="nc-invite-footer-divider mt-6 -mx-4 md:-mx-6 border-t-1 border-nc-border-gray-medium" />

    <div v-if="showFooter" class="flex mt-4 justify-end">
      <div class="flex gap-2 items-center">
        <NcButton type="text" @click="emit('close')"> {{ $t('labels.cancel') }}</NcButton>
        <NcButton
          :disabled="isInviteButtonDisabled || emailValidation.isError || isLoading || !!warningMsg"
          :loading="isLoading"
          size="medium"
          type="primary"
          class="nc-invite-btn"
          @click="inviteCollaborator"
        >
          {{ submitLabel || defaultSubmitLabel }}
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Chips settle in and collapse out rather than snapping, and the leaving chip is
// taken out of flow so the others close the gap in the same frame.
.nc-invite-chip-enter-active,
.nc-invite-chip-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.nc-invite-chip-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.96);
}

.nc-invite-chip-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.nc-invite-chip-leave-active {
  position: absolute;
}

.nc-invite-chip-move {
  transition: transform 150ms ease;
}

:deep(.nc-invite-role-selector .nc-role-badge) {
  @apply w-full;
}

// Brand tint rather than a literal: --color-brand-50 is a dark-palette token, so
// all 12 palettes follow it instead of inheriting one hardcoded blue.
.nc-invite-chip-close {
  @apply opacity-60 transition-opacity duration-150;

  &:hover {
    @apply opacity-100;
  }
}

.nc-invite-field-label {
  @apply text-bodyDefaultSm text-nc-content-gray-muted;
}

.nc-invite-field-strong {
  @apply text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2;
}

.nc-invite-field-hint {
  @apply text-captionSm text-nc-content-gray-muted;
}

// :focus-within rather than a tracked flag; the flag was cleared by the blur
// that fires when adding a chip re-renders the row, killing the ring mid-typing.
.nc-invite-email-box:focus-within {
  @apply border-primary/100 shadow-selected;
}

// NcListDropdown wraps the trigger in a plain div; without this the detail row
// collapses to its content width and the hover surface stops short of the label.
:deep(.nc-invite-role-selector .nc-roles-selector),
:deep(.nc-invite-role-selector .ant-dropdown-trigger) {
  @apply w-full;
}
</style>
