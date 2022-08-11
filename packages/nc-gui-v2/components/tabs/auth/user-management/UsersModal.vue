<script setup lang="ts">
import { Form, notification } from 'ant-design-vue'
import { useClipboard } from '@vueuse/core'
import ShareBase from './ShareBase.vue'
import SendIcon from '~icons/material-symbols/send-outline'
import CloseIcon from '~icons/material-symbols/close-rounded'
import MidAccountIcon from '~icons/mdi/account-outline'
import ContentCopyIcon from '~icons/mdi/content-copy'
import type { User } from '~/lib/types'
import { ProjectRole } from '~/lib/enums'
import { extractSdkResponseErrorMsg, isEmail, projectRoleTagColors } from '~/utils'

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

const { project } = useProject()
const { $api, $e } = useNuxtApp()
const { copy } = useClipboard()

const usersData = $ref<Users>({ emails: undefined, role: ProjectRole.Guest, invitationToken: undefined })
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
          const invalidEmails = (value || '').split(/\s*,\s*/).filter((e: string) => !isEmail(e))
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
    usersData.role = selectedUser.roles
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
      emit('reload')
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
    notification.success({
      message: 'Successfully updated the user details',
    })
  } catch (e: any) {
    console.error(e)
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
    })
  }
}

const inviteUrl = $computed(() =>
  usersData.invitationToken
    ? `${location.origin}${location.pathname}#/user/authentication/signup/${usersData.invitationToken}`
    : null,
)

const copyUrl = async () => {
  if (!inviteUrl) return

  copy(inviteUrl)
  notification.success({
    message: 'Copied shareable base url to clipboard!',
  })

  $e('c:shared-base:copy-url')
}

const clickInviteMore = () => {
  $e('c:user:invite-more')
  usersData.invitationToken = undefined
  usersData.role = ProjectRole.Guest
  usersData.emails = undefined
}
</script>

<template>
  <a-modal :footer="null" centered :visible="show" :closable="false" width="max(50vw, 44rem)" @cancel="emit('closed')">
    <div class="flex flex-col">
      <div class="flex flex-row justify-between items-center pb-1.5 mb-2 border-b-1 w-full">
        <a-typography-title class="select-none" :level="4"> Share: {{ project.title }} </a-typography-title>
        <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="emit('closed')">
          <template #icon>
            <CloseIcon class="flex mx-auto" />
          </template>
        </a-button>
      </div>

      <div class="px-2 mt-1.5">
        <template v-if="usersData.invitationToken">
          <div class="flex flex-col mt-1 border-b-1 pb-5">
            <div class="flex flex-row items-center pl-1.5 pb-1 h-[1.1rem]">
              <MidAccountIcon />
              <div class="text-xs ml-0.5 mt-0.5">Copy Invite Token</div>
            </div>

            <a-alert class="mt-1" type="success" show-icon>
              <template #message>
                <div class="flex flex-row w-full justify-between items-center">
                  <div class="flex pl-2 text-green-700">
                    {{ inviteUrl }}
                  </div>
                  <a-button type="text" class="!rounded-md mr-1" @click="copyUrl">
                    <template #icon>
                      <ContentCopyIcon class="flex mx-auto text-green-700 h-[1rem]" />
                    </template>
                  </a-button>
                </div>
              </template>
            </a-alert>
            <div class="flex text-xs text-gray-500 mt-2 justify-start ml-2">
              Looks like you have not configured mailer yet! Please copy above invite link and send it to
              {{ usersData.invitationToken && usersData.emails }}
            </div>
            <div class="flex flex-row justify-start mt-4 ml-2">
              <a-button size="small" outlined @click="clickInviteMore">
                <div class="flex flex-row justify-center items-center space-x-0.5">
                  <SendIcon class="flex mx-auto text-gray-600 h-[0.8rem]" />
                  <div class="text-xs text-gray-600">Invite more</div>
                </div>
              </a-button>
            </div>
          </div>
        </template>
        <div v-else class="flex flex-col pb-4">
          <div class="flex flex-row items-center pl-2 pb-1 h-[1rem]">
            <MidAccountIcon />
            <div class="text-xs ml-0.5 mt-0.5">{{ selectedUser ? 'Edit User' : 'Invite Team' }}</div>
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
                    <div class="ml-1 mb-1 text-xs text-gray-500">Email:</div>
                    <a-input
                      v-model:value="usersData.emails"
                      validate-trigger="onBlur"
                      placeholder="Email"
                      :disabled="!!selectedUser"
                    />
                  </a-form-item>
                </div>
                <div class="flex flex-col w-1/4">
                  <a-form-item name="role" :rules="[{ required: true, message: 'Role required' }]">
                    <div class="ml-1 mb-1 text-xs text-gray-500">Select User Role:</div>
                    <a-select v-model:value="usersData.role">
                      <a-select-option v-for="(role, index) in Object.keys(projectRoleTagColors)" :key="index" :value="role">
                        <div class="flex flex-row h-full justify-start items-center">
                          <div :class="`px-2 py-1 flex rounded-full text-xs bg-[${projectRoleTagColors[role]}]`">
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
                  <div v-if="selectedUser">Save</div>
                  <div v-else class="flex flex-row justify-center items-center space-x-1.5">
                    <SendIcon class="flex h-[0.8rem]" />
                    <div>Invite</div>
                  </div>
                </a-button>
              </div>
            </a-form>
          </div>
        </div>
        <div class="flex mt-4">
          <ShareBase />
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped></style>
