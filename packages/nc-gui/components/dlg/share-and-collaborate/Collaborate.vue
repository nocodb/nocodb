<script lang="ts" setup>
import { ProjectRole } from '~~/lib'

interface Users {
  emails?: string
  role: ProjectRole
  invitationToken?: string
}

const { loadUsers, users, inviteUser, totalUsers, formStatus } = useManageUsers()

const formRef = ref()
const usersData = $ref<Users>({ emails: undefined, role: ProjectRole.Viewer, invitationToken: undefined })

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

const saveUser = async () => {
  await inviteUser({
    email: usersData.emails!,
    roles: usersData.role!,
  })
}

const openManageCollaborators = () => {
  formStatus.value = 'manageCollaborators'
}

onMounted(async () => {
  if (!users.value) {
    await loadUsers()
  }
})
</script>

<template>
  <div class="flex flex-col">
    <a-form ref="formRef" :validate-on-rule-change="false" :model="usersData" validate-trigger="onBlur" @finish="saveUser">
      <div class="flex flex-col mb-16">
        <div class="flex flex-row space-x-4 mx-2 border-1 border-gray-200 bg-gray-100 rounded-md">
          <div class="flex flex-col w-3/4 relative mt-0.5">
            <a-form-item
              v-bind="validateInfos.emails"
              validate-trigger="onBlur"
              name="emails"
              :rules="[{ required: true, message: 'Please input email' }]"
            >
              <a-input
                v-model:value="usersData.emails"
                :bordered="false"
                type="text"
                validate-trigger="onBlur"
                placeholder="Add people by email..."
              />
            </a-form-item>
          </div>

          <div class="flex flex-col w-1/4">
            <a-form-item name="role" :rules="[{ required: true, message: 'Role required' }]">
              <a-select
                v-model:value="usersData.role"
                class="!rounded-md p-0.5 !bg-gray-200"
                dropdown-class-name="nc-dropdown-user-role !rounded-md"
              >
                <a-select-option v-for="(role, index) in projectRoles" :key="index" :value="role" class="nc-role-option">
                  <div class="flex flex-row h-full justify-start items-center">
                    <div
                      class="px-2 py-1 flex rounded-full text-xs capitalize"
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
      </div>

      <div class="flex flex-row border-t-1 border-gray-200 pt-4 items-center text-xs gap-x-3 ml-1">
        <div :style="{ fontWeight: 500 }">People with access</div>
        <div class="bg-gray-100 border-gray-200 border-1 py-0.5 px-1.5 rounded-md">{{ totalUsers }} users</div>
      </div>
      <div class="flex flex-row justify-between mt-3.5 mb-2">
        <a-button type="text" class="!rounded-md !bg-gray-100" @click="openManageCollaborators">
          <div class="flex flex-row justify-center items-center space-x-1.5">
            <div>Manage Collaborators</div>
          </div>
        </a-button>
        <a-button
          type="primary"
          html-type="submit"
          class="!rounded-md"
          :disabled="validateInfos.emails.validateStatus !== 'success'"
        >
          <div class="flex flex-row justify-center items-center space-x-1.5">
            <div>Add Collaborators</div>
          </div>
        </a-button>
      </div>
    </a-form>
  </div>
</template>
