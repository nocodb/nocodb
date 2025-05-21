<script lang="ts" setup>
const { invitationValid, invitationUsersData } = storeToRefs(useShare())
const { loadUsers, users } = useManageUsers()

const formRef = ref()

const { t } = useI18n()

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
                invalidEmails.length > 1 ? t('msg.error.signUpRules.invalidEmails') : t('msg.error.signUpRules.invalidEmail')
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

const { validateInfos } = useForm(invitationUsersData, validators)

onMounted(async () => {
  if (!users.value) {
    await loadUsers()
  }
})

watch(
  () => validateInfos.emails.validateStatus,
  () => {
    invitationValid.value = validateInfos.emails.validateStatus === 'success' && invitationUsersData.emails?.length !== 0
  },
)
</script>

<template>
  <div class="flex flex-col">
    <a-form ref="formRef" :validate-on-rule-change="false" :model="invitationUsersData" validate-trigger="onBlur">
      <div class="flex flex-col">
        <div class="flex flex-row space-x-2 rounded-md">
          <div class="flex flex-col w-4/5 relative mt-0.5">
            <a-form-item
              v-bind="validateInfos.emails"
              validate-trigger="onBlur"
              name="emails"
              :rules="[{ required: true, message: t('msg.plsInputEmail') }]"
            >
              <a-input
                v-model:value="invitationUsersData.emails"
                type="text"
                class="!rounded-md !ml-0.5"
                validate-trigger="onBlur"
                placeholder="Add people by email..."
                data-testid="docs-share-dlg-share-base-collaborate-emails"
              />
            </a-form-item>
          </div>

          <div class="flex flex-col w-1/5">
            <a-form-item name="role" :rules="[{ required: true, message: t('msg.roleRequired') }]">
              <a-select
                v-model:value="invitationUsersData.role"
                class="!rounded-md !bg-white"
                dropdown-class-name="nc-dropdown-user-role !rounded-md"
                data-testid="docs-share-dlg-share-base-collaborate-role"
              >
                <a-select-option v-for="(role, index) in baseRoles" :key="index" :value="role" class="nc-role-option">
                  <div
                    class="flex flex-row h-full justify-start items-center"
                    :data-testid="`nc-share-invite-user-role-option-${role}`"
                  >
                    <div class="px-2 py-1 flex rounded-full text-xs capitalize">
                      {{ role }}
                    </div>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </div>
        </div>
      </div>
    </a-form>
  </div>
</template>
