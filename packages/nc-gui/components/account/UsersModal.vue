<script setup lang="ts">
import type { OrgUserReqType } from 'nocodb-sdk'
import { EnterpriseOrgUserRoles, OrgUserRoles } from 'nocodb-sdk'
import { extractEmail } from '~/helpers/parsers/parserHelpers'

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
  return [EnterpriseOrgUserRoles.VIEWER, EnterpriseOrgUserRoles.CREATOR, EnterpriseOrgUserRoles.ADMIN]
})

const inviteData = reactive({
  email: '',
  role: hasOrgRoles.value ? EnterpriseOrgUserRoles.VIEWER : OrgUserRoles.VIEWER,
  invitationToken: undefined as string | undefined,
})

const emailBadges = ref<string[]>([])

const isLoading = ref(false)

const isDivFocused = ref(false)

const divRef = ref<HTMLDivElement>()

const focusRef = ref<HTMLInputElement>()

const focusOnDiv = () => {
  isDivFocused.value = true
  focusRef.value?.focus()
}

const handleEnter = () => {
  const email = inviteData.email?.trim()
  if (email && email.includes('@') && !emailBadges.value.includes(email)) {
    emailBadges.value.push(email)
    inviteData.email = ''
  }
}

const removeEmail = (index: number) => {
  emailBadges.value.splice(index, 1)
}

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

const isInviteDisabled = computed(() => emailBadges.value.length === 0 && !inviteData.email?.trim())

const onRoleChange = (role: string) => {
  inviteData.role = role
}

const saveUser = async () => {
  if (inviteData.email?.trim() && inviteData.email.includes('@')) {
    emailBadges.value.push(inviteData.email.trim())
    inviteData.email = ''
  }

  if (emailBadges.value.length === 0) return

  isLoading.value = true
  $e('a:org-user:invite', { role: inviteData.role })

  try {
    for (const email of emailBadges.value) {
      const res = await $api.orgUsers.add({
        roles: inviteData.role,
        email,
      } as unknown as OrgUserReqType)

      inviteData.invitationToken = res.invite_token
    }

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

const inviteUrl = computed(() =>
  inviteData.invitationToken ? `${dashboardUrl.value}/signup/${inviteData.invitationToken}` : null,
)

const clickInviteMore = () => {
  $e('c:user:invite-more')
  inviteData.invitationToken = undefined
  inviteData.role = hasOrgRoles.value ? EnterpriseOrgUserRoles.VIEWER : OrgUserRoles.VIEWER
  emailBadges.value = []
  inviteData.email = ''
}
</script>

<template>
  <NcModal
    :visible="show"
    :show-separator="false"
    size="medium"
    @update:visible="(val) => { if (!val) emit('closed') }"
  >
    <template #header>
      <div class="flex flex-row text-2xl font-bold items-center gap-x-2">
        {{ hasOrgRoles ? $t('activity.inviteToOrg') : $t('activity.inviteUser') }}
      </div>
    </template>

    <div class="flex items-center justify-between gap-3 mt-2">
      <div class="flex w-full gap-4 flex-col">
        <template v-if="inviteData.invitationToken">
          <div class="flex flex-col gap-3 pb-4">
            <NcAlert
              type="success"
              :message="inviteUrl"
              message-class="!text-green-700 !text-bodyDefaultSm"
              background
              :copy-text="inviteUrl"
              :copy-text-toast-message="$t('msg.toast.inviteUrlCopy')"
              class="!p-3"
            />
            <div class="text-xs text-nc-content-gray-muted ml-1">
              {{ $t('msg.info.userInviteNoSMTP') }}
            </div>
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
                :placeholder="$t('activity.enterEmail')"
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

    <div v-if="!inviteData.invitationToken" class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="emit('closed')">
          {{ $t('labels.cancel') }}
        </NcButton>
        <NcButton
          :disabled="isInviteDisabled || isLoading"
          :loading="isLoading"
          size="medium"
          type="primary"
          @click="saveUser"
        >
          {{ $t('activity.invite') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
