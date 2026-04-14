<script setup lang="ts">
import type { OrgUserReqType } from 'nocodb-sdk'
import { EnterpriseOrgUserRoles, NC_DEFAULT_ORG_ID, OrgUserRoles } from 'nocodb-sdk'
interface Props {
  show: boolean
  selectedUser?: User
}

const { show } = defineProps<Props>()

const emit = defineEmits(['closed', 'reload'])

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const { appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const { clearBasesUser } = useBases()

const hasOrgRoles = computed(() => appInfo.value.isOnPrem && appInfo.value.ee)

const allowedRoles = computed(() => {
  if (!hasOrgRoles.value) return [OrgUserRoles.VIEWER]
  return [EnterpriseOrgUserRoles.VIEWER, EnterpriseOrgUserRoles.CREATOR]
})

const inviteData = reactive({
  email: '',
  role: hasOrgRoles.value ? EnterpriseOrgUserRoles.VIEWER : OrgUserRoles.VIEWER,
})

// Collected invite results — populated when SMTP is not configured
const inviteResults = ref<{ email: string; token: string }[]>([])

const emailBadges = ref<string[]>([])

const isLoading = ref(false)

const isDivFocused = ref(false)

const divRef = ref<HTMLDivElement>()

const focusRef = ref<HTMLInputElement>()

const focusOnDiv = () => {
  isDivFocused.value = true
  focusRef.value?.focus()
}

const singleEmailValue = ref('')

const handleEnter = () => {
  if (!inviteData.email?.trim() || !validateEmail(inviteData.email.trim())) return
  // Append space to trigger the watcher which converts to pill
  inviteData.email += ' '
}

const removeEmail = (index: number) => {
  emailBadges.value.splice(index, 1)
}

// Convert email to pill on space or comma — matches workspace InviteDlg behavior
watch(
  () => inviteData.email,
  (val) => {
    // When user types a single valid email without pressing space/comma,
    // keep it as text (not a pill) — it will be picked up on submit
    const isSingleEmailValid = validateEmail(val)
    if (isSingleEmailValid && !emailBadges.value.length) {
      singleEmailValue.value = val
      return
    }
    singleEmailValue.value = ''

    // When last char is space or comma, convert to pill
    const lastChar = val.charAt(val.length - 1)
    if ((lastChar === ' ' || lastChar === ',') && val.trim().length) {
      const emailToAdd = val.split(',')[0].trim() || val.split(' ')[0].trim()
      if (!validateEmail(emailToAdd)) return

      // Deduplicate — if already exists, move to end
      const existingIdx = emailBadges.value.indexOf(emailToAdd)
      if (existingIdx !== -1) {
        emailBadges.value.splice(existingIdx, 1)
      }
      emailBadges.value.push(emailToAdd)
      inviteData.email = ''
      singleEmailValue.value = ''
    }
  },
)

// Remove last email badge on backspace when input is empty
onKeyStroke('Backspace', () => {
  if (isDivFocused.value && !inviteData.email?.length) {
    emailBadges.value.pop()
  }
})

const onPaste = (e: ClipboardEvent) => {
  e.preventDefault()
  const pastedText = e.clipboardData?.getData('text') ?? ''
  const emails = pastedText.split(/[,;\s]+/).filter((em) => em.includes('@'))
  for (const email of emails) {
    if (!emailBadges.value.includes(email.trim())) {
      emailBadges.value.push(email.trim())
    }
  }
}

const isInviteDisabled = computed(() => emailBadges.value.length === 0 && !singleEmailValue.value.length)

const onRoleChange = (role: string) => {
  inviteData.role = role
}

const saveUser = async () => {
  // Collect emails: pills + single typed email
  const payloadEmails = singleEmailValue.value ? [singleEmailValue.value] : [...emailBadges.value]

  // Also pick up any remaining text in the input
  if (!singleEmailValue.value && inviteData.email?.trim() && validateEmail(inviteData.email.trim())) {
    payloadEmails.push(inviteData.email.trim())
  }

  if (payloadEmails.length === 0) return

  isLoading.value = true
  $e('a:org-user:invite', { role: inviteData.role })

  try {
    const orgId = hasOrgRoles.value ? appInfo.value.defaultOrgId || NC_DEFAULT_ORG_ID : undefined

    const results: { email: string; token: string }[] = []

    for (const email of payloadEmails) {
      // CE endpoint creates user + adds to default org as viewer
      const res = await $api.orgUsers.add({
        roles: OrgUserRoles.VIEWER,
        email,
      } as unknown as OrgUserReqType)

      // Collect invite token (present when SMTP is not configured)
      if (res.invite_token) {
        results.push({ email, token: res.invite_token })
      }

      // On-prem: update org role if different from default viewer
      if (orgId && inviteData.role !== EnterpriseOrgUserRoles.VIEWER) {
        // Look up the newly created user by email to get their ID
        const usersRes = await $api.instance.get('/api/v1/users', {
          params: { query: email },
        })
        const user = usersRes.data?.list?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
        if (user?.id) {
          await $api.instance.patch(`/api/v1/orgs/${orgId}/users/${user.id}`, {
            org_role: inviteData.role,
          })
        }
      }
    }

    inviteResults.value = results

    emit('reload')
    message.success(t('msg.success.userAdded'))
    clearBasesUser()
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const hasInviteResults = computed(() => inviteResults.value.length > 0)

const isSingleInvite = computed(() => inviteResults.value.length === 1)

const singleInviteUrl = computed(() =>
  isSingleInvite.value ? `${dashboardUrl.value}/signup/${inviteResults.value[0].token}` : null,
)

const clickInviteMore = () => {
  $e('c:user:invite-more')
  inviteResults.value = []
  inviteData.role = hasOrgRoles.value ? EnterpriseOrgUserRoles.VIEWER : OrgUserRoles.VIEWER
  emailBadges.value = []
  inviteData.email = ''
  singleEmailValue.value = ''
}
</script>

<template>
  <NcModal
    :visible="show"
    :show-separator="false"
    size="medium"
    class="nc-modal-invite-user"
    @update:visible="
      (val) => {
        if (!val) emit('closed')
      }
    "
  >
    <template #header>
      <div class="flex flex-row text-2xl font-bold items-center gap-x-2">
        {{ hasOrgRoles ? $t('activity.inviteToOrg') : $t('activity.inviteUser') }}
      </div>
    </template>

    <div class="flex items-center justify-between gap-3 mt-2">
      <div class="flex w-full gap-4 flex-col">
        <template v-if="hasInviteResults">
          <div class="flex flex-col gap-3 pb-4">
            <!-- Single user: show invite URL inline -->
            <template v-if="isSingleInvite">
              <NcAlert
                type="success"
                :message="singleInviteUrl"
                message-class="!text-green-700 !text-bodyDefaultSm"
                background
                :copy-text="singleInviteUrl"
                :copy-text-toast-message="$t('msg.toast.inviteUrlCopy')"
                class="!p-3"
              />
              <div class="text-xs text-nc-content-gray-muted ml-1">
                {{ $t('msg.info.userInviteNoSMTP') }}
              </div>
            </template>

            <!-- Multiple users: note to use actions menu -->
            <template v-else>
              <NcAlert
                type="warning"
                :message="$t('msg.info.userInviteNoSMTPBulk')"
                message-class="!text-bodyDefaultSm"
                class="!p-3"
              />
            </template>

            <div class="flex justify-end">
              <NcButton size="small" type="secondary" @click="clickInviteMore">
                {{ $t('activity.inviteMore') }}
              </NcButton>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex flex-col gap-6 md:(flex-row gap-3 justify-between) w-full">
            <div
              ref="divRef"
              :class="{
                'border-primary/100 shadow-selected': isDivFocused,
                'p-1': emailBadges.length > 0,
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
                ref="focusRef"
                v-model="inviteData.email"
                inputmode="email"
                :disabled="isLoading"
                placeholder="E-mail"
                data-testid="nc-invite-email-input"
                class="flex-1 md:min-w-36 outline-none px-2"
                @blur="isDivFocused = false"
                @keyup.enter="handleEnter"
                @paste.prevent="onPaste"
              />
            </div>

            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center">
                <RolesSelectorV2
                  v-if="hasOrgRoles"
                  :on-role-change="onRoleChange"
                  :role="inviteData.role"
                  :roles="allowedRoles"
                  class="!min-w-[152px] nc-invite-role-selector"
                  size="lg"
                  placement="bottomRight"
                />
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="!hasInviteResults" class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="emit('closed')">
          {{ $t('labels.cancel') }}
        </NcButton>
        <NcButton :disabled="isInviteDisabled || isLoading" :loading="isLoading" size="medium" type="primary" @click="saveUser">
          {{ $t('activity.invite') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
