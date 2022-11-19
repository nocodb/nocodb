<script setup lang="ts">
import {
  Form,
  computed,
  extractSdkResponseErrorMsg,
  message,
  onMounted,
  projectRoleTagColors,
  projectRoles,
  ref,
  useCopy,
  useDashboard,
  useI18n,
  useNuxtApp,
  useProject,
  validateEmail,
} from '#imports'
import type { User } from '~/lib'
import { ProjectRole } from '~/lib'

interface Props {
  show: boolean
  selectedUser?: User
}

interface Users {
  emails?: string
  role: ProjectRole
  invitationToken?: string
}

const { show, selectedUser } = defineProps<Props>()

const emit = defineEmits(['closed', 'reload'])

const { t } = useI18n()

const { project } = useProject()

const { $api, $e } = useNuxtApp()

const { copy } = useCopy()

const { dashboardUrl } = $(useDashboard())

const usersData = $ref<Users>({ emails: undefined, role: ProjectRole.Viewer, invitationToken: undefined })

const formRef = ref()

const useForm = Form.useForm
const validators = computed(() => {
  return {
    emails: [
      {
        validator: (rule: any, value: string, callback: (errMsg?: string) => void) => {
          if (!value || value.length === 0) {
            callback('Email is required')
            return
          }
          const invalidEmails = (value || '').split(/\s*,\s*/).filter((e: string) => !validateEmail(e))
          if (invalidEmails.length > 0) {
            callback(`${invalidEmails.length > 1 ? ' Invalid emails:' : 'Invalid email:'} ${invalidEmails.join(', ')} `)
          } else {
            callback()
          }
        },
      },
    ],
  }
})

const { validateInfos } = useForm(usersData, validators)

onMounted(() => {
  if (!usersData.emails && selectedUser?.email) {
    usersData.emails = selectedUser.email
    // todo: types not matching, probably a bug here?
    usersData.role = selectedUser.roles as any
  }
})

const saveUser = async () => {
  $e('a:user:invite', { role: usersData.role })

  if (!project.value.id) return

  await formRef.value?.validateFields()

  try {
    if (selectedUser?.id) {
      await $api.auth.projectUserUpdate(project.value.id, selectedUser.id, {
        roles: usersData.role,
        email: selectedUser.email,
        project_id: project.value.id,
        projectName: project.value.title,
      })
      emit('closed')
    } else {
      const res = await $api.auth.projectUserAdd(project.value.id, {
        roles: usersData.role,
        email: usersData.emails,
        project_id: project.value.id,
        projectName: project.value.title,
      })
      usersData.invitationToken = res.invite_token
    }
    emit('reload')

    // Successfully updated the user details
    message.success(t('msg.success.userDetailsUpdated'))
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const inviteUrl = $computed(() => (usersData.invitationToken ? `${dashboardUrl}#/signup/${usersData.invitationToken}` : null))

const copyUrl = async () => {
  if (!inviteUrl) return

  await copy(inviteUrl)

  // Copied shareable base url to clipboard!
  message.success(t('msg.success.shareableURLCopied'))

  $e('c:shared-base:copy-url')
}

const clickInviteMore = () => {
  $e('c:user:invite-more')
  usersData.invitationToken = undefined
  usersData.role = ProjectRole.Viewer
  usersData.emails = undefined
}
</script>

<template>
  <a-modal
    :footer="null"
    centered
    :visible="show"
    :closable="false"
    width="max(50vw, 44rem)"
    wrap-class-name="nc-modal-invite-user-and-share-base"
    @cancel="emit('closed')"
  >
    <div class="flex flex-col">
      <div class="flex flex-row justify-between items-center pb-1.5 mb-2 border-b-1 w-full">
        <a-typography-title class="select-none" :level="4"> {{ $t('activity.share') }}: {{ project.title }} </a-typography-title>

        <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="emit('closed')">
          <template #icon>
            <MaterialSymbolsCloseRounded class="flex mx-auto" />
          </template>
        </a-button>
      </div>

      <div class="px-2 mt-1.5">
        <template v-if="usersData.invitationToken">
          <div class="flex flex-col mt-1 border-b-1 pb-5">
            <div class="flex flex-row items-center pl-1.5 pb-1 h-[1.1rem]">
              <MdiAccountOutline />
              <div class="text-xs ml-0.5 mt-0.5">Copy Invite Token</div>
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
            <div class="text-xs ml-0.5 mt-0.5">{{ selectedUser ? $t('activity.editUser') : $t('activity.inviteTeam') }}</div>
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
                    :rules="[{ required: true, message: 'Please input email' }]"
                  >
                    <div class="ml-1 mb-1 text-xs text-gray-500">{{ $t('datatype.Email') }}:</div>

                    <a-input
                      v-model:value="usersData.emails"
                      validate-trigger="onBlur"
                      :placeholder="$t('labels.email')"
                      :disabled="!!selectedUser"
                    />
                  </a-form-item>
                </div>

                <div class="flex flex-col w-1/4">
                  <a-form-item name="role" :rules="[{ required: true, message: 'Role required' }]">
                    <div class="ml-1 mb-1 text-xs text-gray-500">{{ $t('labels.selectUserRole') }}</div>

                    <a-select v-model:value="usersData.role" class="nc-user-roles" dropdown-class-name="nc-dropdown-user-role">
                      <a-select-option v-for="(role, index) in projectRoles" :key="index" :value="role" class="nc-role-option">
                        <div class="flex flex-row h-full justify-start items-center">
                          <div
                            class="px-2 py-1 flex rounded-full text-xs"
                            :style="{ backgroundColor: projectRoleTagColors[role] }"
                          >
                            {{ role }}
                          </div>
                        </div>
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </div>
              </div>

              <div class="flex flex-row justify-center">
                <a-button type="primary" html-type="submit">
                  <div v-if="selectedUser">{{ $t('general.save') }}</div>

                  <div v-else class="flex flex-row justify-center items-center space-x-1.5">
                    <MaterialSymbolsSendOutline class="flex h-[0.8rem]" />
                    <div>{{ $t('activity.invite') }}</div>
                  </div>
                </a-button>
              </div>
            </a-form>
          </div>
        </div>

        <div class="flex mt-4">
          <LazyTabsAuthUserManagementShareBase />
        </div>
      </div>
    </div>
  </a-modal>
</template>
