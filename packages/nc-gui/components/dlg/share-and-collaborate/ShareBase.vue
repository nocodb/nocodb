<script setup lang="ts">
import { OrderedProjectRoles, ProjectRoles } from 'nocodb-sdk'
import { onKeyStroke } from '@vueuse/core'
import {
  type User,
  extractSdkResponseErrorMsg,
  message,
  onMounted,
  storeToRefs,
  useBase,
  useDashboard,
  useGlobal,
  useNuxtApp,
  useWorkspace,
  validateEmail,
} from '#imports'

interface ShareBase {
  uuid?: string
  url?: string
  role?: string
}

const props = defineProps({
  isView: {
    type: Boolean,
    default: false,
  },
})

enum ShareBaseRole {
  Editor = 'editor',
  Viewer = 'viewer',
}

const { dashboardUrl } = useDashboard()

const { $api, $e } = useNuxtApp()

const { getBaseUrl, appInfo } = useGlobal()

const workspaceStore = useWorkspace()

const baseStore = useBase()

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { base } = storeToRefs(useBase())

const { navigateToProjectPage } = baseStore

const { createProjectUser } = basesStore

const { baseRoles } = useRoles()

const sharedBase = ref<null | ShareBase>(null)

const { showShareModal } = storeToRefs(useShare())

const url = computed(() => {
  if (!sharedBase.value || !sharedBase.value.uuid) return ''

  // get base url for workspace
  const baseUrl = getBaseUrl(workspaceStore.activeWorkspaceId)

  let dashboardUrl1 = dashboardUrl.value

  if (baseUrl) {
    dashboardUrl1 = `${baseUrl}${appInfo.value?.dashboardPath}`
  }
  return encodeURI(`${dashboardUrl1}#/base/${sharedBase.value.uuid}`)
})

const createShareBase = async (role = ShareBaseRole.Viewer) => {
  try {
    if (!base.value.id) return

    const res = await $api.base.sharedBaseUpdate(base.value.id, {
      roles: role,
    })

    sharedBase.value = res ?? {}
    sharedBase.value!.role = role

    base.value.uuid = res.uuid
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:enable', { role })
}

const disableSharedBase = async () => {
  try {
    if (!base.value.id) return

    await $api.base.sharedBaseDisable(base.value.id)
    sharedBase.value = null

    base.value.uuid = undefined
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:disable')
}

const isSharedBaseEnabled = computed(() => !!sharedBase.value?.uuid)
const isToggleBaseLoading = ref(false)
const isRoleToggleLoading = ref(false)

const toggleSharedBase = async () => {
  if (isToggleBaseLoading.value) return
  isToggleBaseLoading.value = true

  try {
    if (isSharedBaseEnabled.value) {
      await disableSharedBase()
    } else {
      await createShareBase()
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isToggleBaseLoading.value = false
  }
}

const openedBaseShareTab = ref<'members' | 'public'>('members')

const allowedRoles = ref<ProjectRoles[]>([])

const inviteData = reactive({
  email: '',
  roles: ProjectRoles.VIEWER,
})

const focusRef = ref<HTMLInputElement>()
const isDivFocused = ref(false)
const divRef = ref<HTMLDivElement>()

const emailBadges = ref<Array<string>>([])

const emailValidation = reactive({
  isError: true,
  message: '',
})
const singleEmailValue = ref('')

const focusOnDiv = () => {
  focusRef.value?.focus()
  isDivFocused.value = true
}

const isInviteButtonDisabled = computed(() => {
  if (!emailBadges.value.length && !singleEmailValue.value.length) {
    return true
  }
  if (emailBadges.value.length && inviteData.email) {
    return true
  }
})

// remove one email per backspace
onKeyStroke('Backspace', () => {
  if (isDivFocused.value && inviteData.email.length < 1) {
    emailBadges.value.pop()
  }
})

onMounted(async () => {
  try {
    const currentRoleIndex = OrderedProjectRoles.findIndex(
      (role) => baseRoles.value && Object.keys(baseRoles.value).includes(role),
    )
    if (currentRoleIndex !== -1) {
      allowedRoles.value = OrderedProjectRoles.slice(currentRoleIndex + 1).filter((r) => r)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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
const handleEnter = () => {
  const isEmailIsValid = emailInputValidation(inviteData.email)
  if (!isEmailIsValid) return

  inviteData.email += ' '
  emailValidation.isError = false
  emailValidation.message = ''
}

const loadBase = async () => {
  try {
    if (!base.value.id) return
    const res = await $api.base.sharedBaseGet(base.value.id)
    sharedBase.value = {
      uuid: res.uuid,
      url: res.url,
      role: res.roles,
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const onRoleToggle = async () => {
  if (!sharedBase.value) return
  if (isRoleToggleLoading.value) return
  isRoleToggleLoading.value = true
  try {
    if (sharedBase.value.role === ShareBaseRole.Viewer) {
      await createShareBase(ShareBaseRole.Editor)
    } else {
      await createShareBase(ShareBaseRole.Viewer)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isRoleToggleLoading.value = false
  }
}

const inviteProjectCollaborator = async () => {
  try {
    const payloadData = singleEmailValue.value || emailBadges.value.join(',')
    if (!payloadData.includes(',')) {
      const validationStatus = validateEmail(payloadData)
      if (!validationStatus) {
        emailValidation.isError = true
        emailValidation.message = 'invalid email'
      }
    }
    await createProjectUser(activeProjectId.value!, {
      email: payloadData,
      roles: inviteData.roles,
    } as unknown as User)

    message.success('Invitation sent successfully')
    inviteData.email = ''
    emailBadges.value = []
    showShareModal.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    singleEmailValue.value = ''
  }
}

const onPaste = (e: ClipboardEvent) => {
  const pastedText = e.clipboardData?.getData('text')

  if (!pastedText) return

  let inputArray

  if (pastedText?.includes(',')) {
    inputArray = pastedText?.split(',')
  } else if (pastedText?.includes(' ')) {
    inputArray = pastedText?.split(' ')
  } else {
    inputArray = pastedText?.split('\n')
  }

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

const openManageAccess = async () => {
  try {
    await navigateToProjectPage({ page: 'collaborator' })
    showShareModal.value = false
  } catch (e) {
    console.error(e)
    message.error('Failed to open manage access')
  }
}

onMounted(() => {
  if (!sharedBase.value) {
    loadBase()
  }
})
</script>

<template>
  <div class="flex flex-col !h-80 gap-2" data-testid="nc-share-base-sub-modal">
    <NcTabs v-model:activeKey="openedBaseShareTab" class="nc-base-share-tab h-full" size="small">
      <a-tab-pane key="members">
        <template #tab>
          <div class="tab" data-testid="nc-base-share-member">
            <GeneralIcon :class="{}" class="tab-icon" icon="user" />
            <div class="text-xs">Add Members</div>
          </div>
        </template>

        <div class="my-4 space-y-3">
          <div class="flex justify-between items-center">
            <div class="gap-2 flex items-center text-gray-500">
              <span> {{ $t('activity.invite') }} </span>
              <RolesSelector
                :description="false"
                :on-role-change="(role: ProjectRoles) => (inviteData.roles = role)"
                :role="inviteData.roles"
                :roles="allowedRoles"
                class="px-1 !min-w-[152px] nc-invite-role-selector"
                size="md"
              />
              <span>
                {{ $t('activity.toBase') }}
              </span>
              <span class="flex text-gray-600 items-center py-1 px-2 gap-2 border-1 rounded-lg border-gray-200 text-md">
                <GeneralProjectIcon
                  :color="parseProp(base.meta).iconColor"
                  :type="base.type"
                  class="nc-view-icon w-4 h-4 group-hover"
                />
                <span class="max-w-72 truncate">
                  <NcTooltip show-on-truncate-only>
                    <template #title> {{ base.title }} </template>
                    <span class="ellipsis max-w-64">
                      {{ base.title }}
                    </span>
                  </NcTooltip>
                </span>
              </span>
            </div>
            <NcTooltip>
              <template #title>{{ $t('labels.enterMultipleEmails') }} </template>
              <component :is="iconMap.info" />
            </NcTooltip>
          </div>
          <div class="flex flex-col">
            <div
              ref="divRef"
              :class="{
                'border-gray-200': isDivFocused,
              }"
              class="flex py-2 px-4 border-1 gap-1 items-center max-h-46 flex-wrap rounded-lg nc-scrollbar-md"
              tabindex="0"
              @blur="isDivFocused = false"
              @click="focusOnDiv"
            >
              <span
                v-for="(email, index) in emailBadges"
                :key="email"
                class="leading-4 border-1 text-gray-800 bg-gray-100 rounded-md ml-1 px-2 py-1"
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
                @blur="isDivFocused = false"
                @keyup.enter="handleEnter"
                @paste.prevent="onPaste"
              />
            </div>
            <span v-if="emailValidation.isError && emailValidation.message" class="ml-2 text-red-500 text-[10px] mt-1.5">{{
              emailValidation.message
            }}</span>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="public">
        <template #tab>
          <div class="tab" data-testid="nc-base-share-public">
            <MaterialSymbolsPublic />
            <div class="text-xs">Share Publicly</div>
          </div>
        </template>
        <div class="border-1 my-4 p-3 border-1 space-y-3 border-gray-200 rounded-lg">
          <div class="flex flex-row items-center w-full">
            <div class="flex text-gray-700 !w-full font-medium items-center gap-2 px-2">
              {{ $t('activity.enablePublicAccess') }}
              <span class="flex items-center p-2 gap-2 border-1 rounded-lg border-gray-200 text-xs">
                <GeneralProjectIcon
                  :color="parseProp(base.meta).iconColor"
                  :type="base.type"
                  class="nc-view-icon w-4 h-4 group-hover"
                />
                <span class="max-w-72 truncate">
                  <NcTooltip show-on-truncate-only>
                    <template #title> {{ base.title }} </template>
                    <span class="ellipsis max-w-64">
                      {{ base.title }}
                    </span>
                  </NcTooltip>
                </span>
              </span>
            </div>
            <NcSwitch
              v-e="['c:share:base:enable:toggle']"
              :checked="isSharedBaseEnabled"
              class="ml-2"
              @change="toggleSharedBase"
            />
          </div>
          <div v-if="isSharedBaseEnabled" class="space-y-3">
            <GeneralCopyUrl
              v-model:url="url"
              :class="{
                'w-135': props.isView,
              }"
            />
            <div v-if="!appInfo.ee" class="flex flex-row gap-3 items-center">
              <a-switch
                v-e="['c:share:base:role:toggle']"
                :checked="sharedBase?.role === ShareBaseRole.Editor"
                :loading="isRoleToggleLoading"
                class="share-editor-toggle !mt-0.25"
                data-testid="share-password-toggle"
                size="small"
                @click="onRoleToggle"
              />
              <div class="flex text-black">{{ $t('activity.editingAccess') }}</div>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </NcTabs>
    <div class="flex gap-2 items-end justify-end">
      <NcButton type="secondary" @click="showShareModal = false">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton type="secondary" @click="openManageAccess">
        {{ $t('activity.manageAccess') }}
      </NcButton>
      <NcButton v-if="openedBaseShareTab === 'members'" :disabled="isInviteButtonDisabled" @click="inviteProjectCollaborator">
        {{ $t('activity.inviteMembers') }}
      </NcButton>
      <NcButton v-else-if="openedBaseShareTab === 'public'" type="secondary" @click="showShareModal = false">
        {{ $t('general.finish') }}
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-invite-role-selector .nc-role-badge) {
  @apply w-full;
}
.tab {
  @apply flex flex-row items-center gap-x-2;
}
.nc-tabs .ant-tabs-nav {
  @apply !pl-0;
}

.ant-tabs-nav .ant-tabs-nav-wrap {
  @apply !justify-start;
}

.ant-tabs-content {
  @apply !h-full;
}

.ant-tabs-content-top {
  @apply !h-full;
}
</style>
