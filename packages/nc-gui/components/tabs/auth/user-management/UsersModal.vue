<script setup lang="ts">
import type { Input } from 'ant-design-vue'
import { ProjectRoles, RoleColors } from 'nocodb-sdk'
import type { ProjectUserReqType } from 'nocodb-sdk'

interface Props {
  show: boolean
  selectedUser?: User | null
}

const { show, selectedUser } = defineProps<Props>()

const emit = defineEmits(['closed', 'reload'])

const { t } = useI18n()

const { base } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const { $api, $e } = useNuxtApp()

const { copy } = useCopy()

const { dashboardUrl } = useDashboard()

const usersData = ref<Users>({ emails: undefined, role: ProjectRoles.VIEWER, invitationToken: undefined })

const formRef = ref()

const useForm = Form.useForm

const validators = computed(() => {
  return {
    emails: [emailValidator],
  }
})

const { validateInfos } = useForm(usersData.value, validators)

onMounted(() => {
  if (!usersData.value.emails && selectedUser?.email) {
    usersData.value.emails = selectedUser.email
    // todo: types not matching, probably a bug here?
    usersData.value.role = selectedUser.roles as any
  }
})

const close = () => {
  emit('closed')
  usersData.value = { role: ProjectRoles.VIEWER }
}

const saveUser = async () => {
  $e('a:user:invite', { role: usersData.value.role })

  if (!base.value.id) return

  await formRef.value?.validateFields()

  try {
    if (selectedUser?.id) {
      await $api.auth.baseUserUpdate(base.value.id, selectedUser.id, {
        roles: usersData.value.role as ProjectRoles,
        email: selectedUser.email,
        base_id: base.value.id,
        baseName: base.value.title,
      })
      close()
    } else {
      const res = await $api.auth.baseUserAdd(base.value.id, {
        roles: usersData.value.role,
        email: usersData.value.emails,
      } as ProjectUserReqType)

      // for inviting one user, invite_token will only be returned when invitation email fails to send
      // for inviting multiple users, invite_token will be returned anyway
      usersData.value.invitationToken = res?.invite_token
    }
    emit('reload')

    // Successfully updated the user details
    message.success(t('msg.success.userDetailsUpdated'))
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
  try {
    await copy(inviteUrl.value)

    // Copied shareable source url to clipboard!
    message.success(t('msg.success.shareableURLCopied'))
  } catch (e: any) {
    message.error(e.message)
  }
  $e('c:shared-base:copy-url')
}

const clickInviteMore = () => {
  $e('c:user:invite-more')
  usersData.value.invitationToken = undefined
  usersData.value.role = ProjectRoles.VIEWER
  usersData.value.emails = undefined
}

const emailField = ref<typeof Input>()

useActiveKeydownListener(
  computed(() => show),
  (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close()
    }
  },
  { immediate: true, isGridCell: false },
)

watch(
  () => show,
  async (val) => {
    if (val) {
      await nextTick()
      emailField.value?.$el?.focus()
    }
  },
  { immediate: true },
)
</script>

<template>
  <GeneralModal centered :visible="show" @cancel="close">
    <div class="flex flex-col p-6" data-testid="invite-user-and-share-base-modal">
      <div class="flex flex-row justify-between items-center pb-1.5 mb-2 border-b-1 border-gray-100 w-full">
        <div v-if="!isMobileMode" class="select-none font-medium">
          {{ $t('activity.share') }}
        </div>
      </div>

      <div class="px-2 mt-1.5">
        <template v-if="usersData.invitationToken">
          <div class="flex flex-col mt-1 border-b-1 pb-5">
            <div class="flex flex-row items-center pl-1.5 pb-1 h-[1.1rem]">
              <component :is="iconMap.account" />
              <div class="text-xs ml-0.5 mt-0.5">Copy Invite Token</div>
            </div>

            <a-alert class="mt-1" type="success" show-icon>
              <template #message>
                <div class="flex flex-row justify-between items-center py-1">
                  <div class="flex pl-2 text-green-700 text-xs" data-testid="invite-modal-invitation-url">
                    {{ inviteUrl }}
                  </div>

                  <a-button type="text" class="!rounded-md -mt-0.5" @click="copyUrl">
                    <template #icon>
                      <component :is="iconMap.copy" class="flex mx-auto text-green-700 h-[1rem]" />
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
          <div v-if="selectedUser" class="flex flex-row items-center pl-2 pb-1 h-[1rem]">
            <component :is="iconMap.account" />
            <div class="text-xs ml-0.5 mt-0.5">{{ selectedUser ? $t('activity.editUser') : $t('activity.inviteTeam') }}</div>
          </div>

          <a-form ref="formRef" :validate-on-rule-change="false" :model="usersData" validate-trigger="onBlur" @finish="saveUser">
            <div class="border-1 py-3 px-4 rounded-md mt-1">
              <div class="flex flex-row space-x-4">
                <div class="flex flex-col w-3/4">
                  <a-form-item
                    v-bind="validateInfos.emails"
                    validate-trigger="onBlur"
                    name="emails"
                    :rules="[{ required: true, message: t('msg.plsInputEmail') }]"
                  >
                    <div class="ml-1 mb-1 text-xs text-gray-500">{{ $t('datatype.Email') }}:</div>

                    <a-input
                      ref="emailField"
                      v-model:value="usersData.emails"
                      size="middle"
                      validate-trigger="onBlur"
                      :placeholder="$t('labels.email')"
                      :disabled="!!selectedUser"
                    />
                  </a-form-item>
                </div>

                <div class="flex flex-col w-1/4">
                  <a-form-item name="role" :rules="[{ required: true, message: t('msg.roleRequired') }]">
                    <div class="ml-1 mb-1 text-xs text-gray-500">{{ $t('labels.selectUserRole') }}</div>

                    <a-select
                      v-model:value="usersData.role"
                      size="middle"
                      class="nc-user-roles !rounded-md"
                      dropdown-class-name="nc-dropdown-user-role"
                    >
                      <a-select-option v-for="(role, index) in ProjectRoles" :key="index" :value="role" class="nc-role-option">
                        <div class="flex flex-row h-full justify-start items-center">
                          <div class="px-3 py-1 flex rounded-full text-xs" :style="{ backgroundColor: RoleColors[role] }">
                            {{ role }}
                          </div>
                        </div>
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </div>
              </div>

              <div class="flex flex-row justify-end">
                <a-button type="primary" html-type="submit" class="!rounded-md">
                  <div v-if="selectedUser">{{ $t('general.save') }}</div>

                  <div v-else class="flex flex-row justify-center items-center space-x-1.5">
                    <MaterialSymbolsSendOutline class="flex h-[0.8rem]" />
                    <div>{{ $t('activity.invite') }}</div>
                  </div>
                </a-button>
              </div>
            </div>
          </a-form>
        </div>

        <div class="flex">
          <LazyTabsAuthUserManagementShareBase />
        </div>
      </div>

      <div class="flex flex-row justify-end gap-x-2 border-t-1 border-gray-100 pt-3">
        <a-button key="back" class="!rounded-md" @click="cancel">{{ $t('general.cancel') }}</a-button>
        <a-button class="!rounded-md">Manage base access</a-button>
        <a-button key="submit" class="!rounded-md" type="primary" :loading="loading">{{ $t('activity.share') }}</a-button>
      </div>
    </div>
  </GeneralModal>
</template>
