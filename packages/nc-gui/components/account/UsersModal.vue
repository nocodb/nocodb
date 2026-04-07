<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
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

const orgRoleOptions = computed(() => {
  if (!hasOrgRoles.value) return []
  return [
    { value: EnterpriseOrgUserRoles.VIEWER, label: t('objects.roleType.viewer') },
    { value: EnterpriseOrgUserRoles.CREATOR, label: t('objects.roleType.creator') },
    { value: EnterpriseOrgUserRoles.ADMIN, label: t('objects.roleType.admin') },
  ]
})

const usersData = ref<Users>({
  emails: '',
  role: hasOrgRoles.value ? EnterpriseOrgUserRoles.VIEWER : OrgUserRoles.VIEWER,
  invitationToken: undefined,
})

const emailBadges = ref<string[]>([])

const singleEmailValue = ref('')

const isDivFocused = ref(false)

const divRef = ref<HTMLDivElement>()

const focusRef = ref<HTMLInputElement>()

const formRef = ref()

const useForm = Form.useForm

const validators = computed(() => {
  return {
    emails: [emailValidator],
  }
})

const { validateInfos } = useForm(usersData.value, validators)

const focusOnDiv = () => {
  isDivFocused.value = true
  focusRef.value?.focus()
}

const handleEnter = () => {
  const email = singleEmailValue.value?.trim()
  if (email && email.includes('@') && !emailBadges.value.includes(email)) {
    emailBadges.value.push(email)
    singleEmailValue.value = ''
  }
}

const removeEmail = (index: number) => {
  emailBadges.value.splice(index, 1)
}

const onPaste = (e: ClipboardEvent) => {
  e.preventDefault()
  const pastedText = e.clipboardData?.getData('text') ?? ''
  const emails = pastedText.split(/[,;\s]+/).filter((e) => e.includes('@'))
  for (const email of emails) {
    if (!emailBadges.value.includes(email.trim())) {
      emailBadges.value.push(email.trim())
    }
  }
}

const isInviteDisabled = computed(() => emailBadges.value.length === 0 && !singleEmailValue.value.trim())

const saveUser = async () => {
  // Add any remaining typed email
  if (singleEmailValue.value?.trim() && singleEmailValue.value.includes('@')) {
    emailBadges.value.push(singleEmailValue.value.trim())
    singleEmailValue.value = ''
  }

  if (emailBadges.value.length === 0) return

  $e('a:org-user:invite', { role: usersData.value.role })

  try {
    for (const email of emailBadges.value) {
      const res = await $api.orgUsers.add({
        roles: usersData.value.role,
        email,
      } as unknown as OrgUserReqType)

      usersData.value.invitationToken = res.invite_token
    }

    emit('reload')
    message.success(t('msg.success.userAdded'))
    clearBasesUser()
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const inviteUrl = computed(() =>
  usersData.value.invitationToken ? `${dashboardUrl.value}/signup/${usersData.value.invitationToken}` : null,
)

const clickInviteMore = () => {
  $e('c:user:invite-more')
  usersData.value.invitationToken = undefined
  usersData.value.role = hasOrgRoles.value ? EnterpriseOrgUserRoles.VIEWER : OrgUserRoles.VIEWER
  emailBadges.value = []
  singleEmailValue.value = ''
}

const onRoleChange = (role: string) => {
  usersData.value.role = role
}
</script>

<template>
  <NcModal
    :visible="show"
    size="medium"
    :show-separator="false"
    @update:visible="(val) => { if (!val) emit('closed') }"
  >
    <template #header>
      <div class="flex flex-row text-2xl font-bold items-center gap-x-2">
        {{ $t('activity.inviteUser') }}
      </div>
    </template>

    <div class="flex flex-col gap-4 mt-2">
      <template v-if="usersData.invitationToken">
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
        <div class="flex flex-col gap-4">
          <div class="flex gap-3 items-start">
            <!-- Email input with badges -->
            <div
              ref="divRef"
              :class="{
                'border-primary/100 shadow-selected': isDivFocused,
                'p-1': emailBadges.length > 0,
              }"
              class="flex items-center flex-wrap border-1 gap-1 w-full overflow-x-auto nc-scrollbar-x-md min-h-10 rounded-lg flex-1"
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
                  class="ml-0.5 hover:cursor-pointer w-4 h-4 text-nc-content-gray-subtle2"
                  @click="removeEmail(index)"
                />
              </span>
              <input
                ref="focusRef"
                v-model="singleEmailValue"
                inputmode="email"
                :placeholder="$t('activity.enterEmail')"
                class="flex-1 min-w-36 outline-none px-2"
                @blur="isDivFocused = false"
                @keyup.enter="handleEnter"
                @paste="onPaste"
              />
            </div>

            <!-- Role selector -->
            <NcSelect
              v-if="hasOrgRoles"
              :value="usersData.role"
              class="!min-w-[140px]"
              @update:value="onRoleChange"
            >
              <a-select-option
                v-for="opt in orgRoleOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </NcSelect>
          </div>

          <div class="flex justify-end gap-2">
            <NcButton size="small" type="secondary" @click="emit('closed')">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton size="small" type="primary" :disabled="isInviteDisabled" @click="saveUser">
              {{ $t('activity.invite') }}
            </NcButton>
          </div>
        </div>
      </template>
    </div>
  </NcModal>
</template>
