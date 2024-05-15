<script setup lang="ts">
import { WorkspaceUserRoles } from 'nocodb-sdk'

interface Props {
  show: boolean
  selectedUser?: User
}

const { show } = defineProps<Props>()

const emit = defineEmits(['closed', 'reload'])

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const { copy } = useCopy()

const { dashboardUrl } = useDashboard()

const usersData = ref<Users>({ emails: '', role: WorkspaceUserRoles.VIEWER, invitationToken: undefined })

const formRef = ref()

const useForm = Form.useForm
const validators = computed(() => {
  return {
    emails: [
      {
        validator: (rule: any, value: string, callback: (errMsg?: string) => void) => {
          if (!value || value.length === 0) {
            callback(t('msg.error.signUpRules.emailRequired'))
            return
          }
          const invalidEmails = (value || '').split(/\s*,\s*/).filter((e: string) => !validateEmail(e))
          if (invalidEmails.length > 0) {
            callback(
              `${
                invalidEmails.length > 1
                  ? `${t('msg.error.signUpRules.invalidEmails')}: `
                  : `${t('msg.error.signUpRules.invalidEmail')}: `
              } ${invalidEmails.join(', ')} `,
            )
          } else {
            callback()
          }
        },
      },
    ],
  }
})

const { validateInfos } = useForm(usersData.value, validators)

const saveUser = async () => {
  $e('a:org-user:invite', { role: usersData.value.role })

  await formRef.value?.validateFields()

  try {
    // todo: update sdk(swagger.json)
    const res = await $api.orgUsers.add({
      roles: usersData.value.role,
      email: usersData.value.emails,
    })

    usersData.value.invitationToken = res.invite_token
    emit('reload')

    // Successfully updated the user details
    message.success(t('msg.success.userAdded'))
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const inviteUrl = computed(() =>
  usersData.value.invitationToken ? `${dashboardUrl.value}#/signup/${usersData.value.invitationToken}` : null,
)

const copyUrl = async () => {
  if (!inviteUrl.value) return

  await copy(inviteUrl.value)

  // Copied shareable source url to clipboard!
  message.success(t('msg.success.shareableURLCopied'))

  $e('c:shared-base:copy-url')
}

const clickInviteMore = () => {
  $e('c:user:invite-more')
  usersData.value.invitationToken = undefined
  usersData.value.role = WorkspaceUserRoles.VIEWER
  usersData.value.emails = ''
}
const emailInput = ref((el) => {
  el?.focus()
})
</script>

<template>
  <a-modal
    :class="{ active: show }"
    :footer="null"
    centered
    :visible="show"
    :closable="false"
    width="max(50vw, 44rem)"
    wrap-class-name="nc-modal-invite-user"
    @cancel="emit('closed')"
  >
    <div class="flex flex-col">
      <div class="flex flex-row justify-between items-center pb-1.5 mb-2 border-b-1 w-full">
        <a-typography-title class="select-none" :level="4"> {{ $t('activity.inviteUser') }}</a-typography-title>

        <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="emit('closed')">
          <template #icon>
            <MaterialSymbolsCloseRounded data-testid="nc-root-user-invite-modal-close" class="flex mx-auto" />
          </template>
        </a-button>
      </div>

      <div class="px-2 mt-1.5">
        <template v-if="usersData.invitationToken">
          <div class="flex flex-col mt-1 border-b-1 pb-5">
            <div class="flex flex-row items-center pl-1.5 pb-1 h-[1.1rem]">
              <MdiAccountOutline />
              <div class="text-xs ml-0.5 mt-0.5">{{ $t('title.copyInviteToken') }}</div>
            </div>

            <a-alert class="mt-1" type="success" show-icon>
              <template #message>
                <div class="flex flex-row justify-between items-center py-1">
                  <div class="flex pl-2 text-green-700 text-xs">
                    {{ inviteUrl }}
                  </div>

                  <a-button type="text" class="!rounded-md -mt-0.5" @click="copyUrl">
                    <template #icon>
                      <MdiContentCopy class="flex mx-auto text-green-700 h-[1rem]" />
                    </template>
                  </a-button>
                </div>
              </template>
            </a-alert>

            <div class="flex text-xs text-gray-500 mt-2 justify-start ml-2">
              {{ $t('msg.info.userInviteNoSMTP') }}
              {{ usersData.invitationToken && usersData.emails }}
            </div>

            <div class="flex flex-row justify-start mt-4 ml-2">
              <a-button size="small" outlined @click="clickInviteMore">
                <div class="flex flex-row justify-center items-center space-x-0.5">
                  <MaterialSymbolsSendOutline class="flex mx-auto text-gray-600 h-[0.8rem]" />

                  <div class="text-xs text-gray-600">{{ $t('activity.inviteMore') }}</div>
                </div>
              </a-button>
            </div>
          </div>
        </template>

        <div v-else class="flex flex-col pb-4">
          <div class="flex flex-row items-center pl-2 pb-1 h-[1rem]">
            <MdiAccountOutline />
            <div class="text-xs ml-0.5 mt-0.5">{{ $t('activity.inviteUser') }}</div>
          </div>

          <div class="border-1 py-3 px-4 rounded-md mt-1">
            <a-form
              ref="formRef"
              :validate-on-rule-change="false"
              :model="usersData"
              validate-trigger="onBlur"
              @finish="saveUser"
            >
              <div class="flex flex-row space-x-4">
                <div class="flex flex-col w-3/4">
                  <a-form-item
                    v-bind="validateInfos.emails"
                    validate-trigger="onBlur"
                    name="emails"
                    :rules="[{ required: true, message: $t('msg.plsInputEmail') }]"
                  >
                    <div class="ml-1 mb-1 text-xs text-gray-500">{{ $t('datatype.Email') }}:</div>

                    <a-input
                      :ref="emailInput"
                      v-model:value="usersData.emails"
                      validate-trigger="onBlur"
                      :placeholder="$t('labels.email')"
                    />
                  </a-form-item>
                </div>

                <div class="flex flex-col w-2/4">
                  <a-form-item name="role" :rules="[{ required: true, message: $t('msg.roleRequired') }]">
                    <div class="ml-1 mb-1 text-xs text-gray-500">{{ $t('labels.selectUserRole') }}</div>

                    <a-select v-model:value="usersData.role" class="nc-user-roles" dropdown-class-name="nc-dropdown-user-role">
                      <a-select-option
                        class="nc-role-option"
                        :value="WorkspaceUserRoles.CREATOR"
                        :label="$t(`objects.roleType.workspaceLevelCreator`)"
                      >
                        <div>{{ $t(`objects.roleType.workspaceLevelCreator`) }}</div>
                        <span class="text-gray-500 text-xs whitespace-normal">
                          {{ $t('msg.info.roles.workspaceLevelCreator') }}
                        </span>
                      </a-select-option>
                      <a-select-option
                        class="nc-role-option"
                        :value="WorkspaceUserRoles.EDITOR"
                        :label="$t(`objects.roleType.workspaceLevelEditor`)"
                      >
                        <div>{{ $t(`objects.roleType.workspaceLevelEditor`) }}</div>
                        <span class="text-gray-500 text-xs whitespace-normal">
                          {{ $t('msg.info.roles.workspaceLevelEditor') }}
                        </span>
                      </a-select-option>
                      <a-select-option
                        class="nc-role-option"
                        :value="WorkspaceUserRoles.COMMENTER"
                        :label="$t(`objects.roleType.workspaceLevelCommenter`)"
                      >
                        <div>{{ $t(`objects.roleType.workspaceLevelCommenter`) }}</div>
                        <span class="text-gray-500 text-xs whitespace-normal">
                          {{ $t('msg.info.roles.workspaceLevelCommenter') }}
                        </span>
                      </a-select-option>

                      <a-select-option
                        class="nc-role-option"
                        :value="WorkspaceUserRoles.VIEWER"
                        :label="$t(`objects.roleType.workspaceLevelViewer`)"
                      >
                        <div>{{ $t(`objects.roleType.workspaceLevelViewer`) }}</div>
                        <span class="text-gray-500 text-xs whitespace-normal">
                          {{ $t('msg.info.roles.workspaceLevelViewer') }}
                        </span>
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </div>
              </div>

              <div class="flex flex-row justify-center">
                <a-button type="primary" html-type="submit">
                  <div class="flex flex-row justify-center items-center space-x-1.5">
                    <MaterialSymbolsSendOutline class="flex h-[0.8rem]" />
                    <div>{{ $t('activity.invite') }}</div>
                  </div>
                </a-button>
              </div>
            </a-form>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>
