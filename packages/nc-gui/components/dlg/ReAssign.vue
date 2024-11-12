<script lang="ts" setup>
const { loadUsers, users } = useManageUsers()

interface Props {
  modelValue: boolean
  view?: Record<string, any>
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

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

const invitationUsersData = ref({})

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


const basesStore = useBases()

const baseStore = useBase()

const { basesUser } = storeToRefs(basesStore)
const { idUserMap } = storeToRefs(baseStore)
const baseUsers = computed(() => (props.view.base_id ? basesUser.value.get(props.view.base_id) || [] : []))

const {user} = useGlobal()

const searchQuery = ref('')
</script>

<template>
  <NcModal v-model:visible="vModel"
          wrap-class-name="nc-modal-re-assign"
           width="448px"
      >
    <div class="mb-4">
          <div class="flex text-base font-bold mb-2">Re-assign this view</div>
          <div class="flex">Once reassigned, you will no longer be able to edit the view configuration.</div>
    </div>

    <div class="mb-4">
        Current owner
            <div class="flex flex-row items-center gap-x-2 h-12.5 p-2 bg-gray-100 rounded">
              <GeneralUserIcon
                  size="auto"
                  :name="user.display_name?.trim() ? user.display_name?.trim() : ''"
                  :email="user.email"
                  class="!text-[0.65rem]"
              />
              <div class="flex flex-col justify-center">
                <div class="flex" :style="{ fontWeight: 500 }">{{ user.display_name }}</div>
                <div class="flex text-xs">
                  {{ user.email }}
                </div>
              </div>

        </div>
    </div>
    <div>
      <span>
        New owner
        <div class="rounded border-1">

            <div class="flex flex-row items-center gap-x-2 h-12.5 p-2">
              <GeneralIcon icon="search" class="text-gray-500 ml-2"/>
                      <input v-model="searchQuery" class="border-0 px-2.5   outline-none " />
            </div>

          <div v-for="user of baseUsers" style="border-top: 1px solid; border-color: inherit">
            <div class="flex flex-row items-center gap-x-2 h-12.5 p-2">
              <GeneralUserIcon
                  size="auto"
                  :name="user.display_name?.trim() ? user.display_name?.trim() : ''"
                  :email="user.email"
                  class="!text-[0.65rem]"
              />
              <div class="flex flex-col justify-center">
                <div class="flex" :style="{ fontWeight: 500 }">{{ user.display_name }}</div>
                <div class="flex text-xs">
                  {{ user.email }}
                </div>
              </div>
            </div>
          </div>

        </div>
      </span>
    </div>

    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="dialogShow = false"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
            size="small"
            type="primary"
            class="nc-invite-btn"
        >
          {{  $t('activity.assignView') }}
        </NcButton>
      </div>
    </div>

  </NcModal>
</template>
