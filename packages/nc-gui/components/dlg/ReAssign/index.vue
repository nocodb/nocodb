<script lang="ts" setup>
import UserItem from './UserItem.vue'
const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { loadUsers, users } = useManageUsers()

interface Props {
  modelValue: boolean
  view?: Record<string, any>
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
}

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

const { basesUser } = storeToRefs(basesStore)

const searchQuery = ref('')
const selectedUser = ref()
const userSelectMenu = ref(false)

const filterdBaseUsers = computed(() => {
  let users = props.view.base_id ? basesUser.value.get(props.view.base_id) || [] : []
  if (searchQuery.value) {
    const keyword = searchQuery.value.toLowerCase()
    users = users.filter((u) => {
      return u.display_name?.toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword)
    })
  }

  return users.filter((u) => u.id !== user.value?.id)
})

const { user } = useGlobal()

const { api, isLoading } = useApi()

const assignView = async () => {
  try {
    if (!selectedUser.value) return
    await api.dbView.update(props.view.id, {
      owned_by: selectedUser.value.id,
    })
    props.view.owned_by = selectedUser.value.id
    vModel.value = false
    await message.success('View reassigned successfully')
  } catch (e) {
    await message.error(await extractSdkResponseErrorMsg(e))
  }
}

const selectUser = (user) => {
  selectedUser.value = user
  userSelectMenu.value = false
}

const inputEl = (el: HTMLInputElement) => {
  setTimeout(() => el?.focus(), 100)
}
</script>

<template>
  <NcModal v-model:visible="vModel" wrap-class-name="nc-modal-re-assign" width="448px">
    <div class="mb-4">
      <div class="flex text-base font-bold mb-2">Re-assign this view</div>
      <div class="flex">Once reassigned, you will no longer be able to edit the view configuration.</div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Current owner</div>
      <UserItem :user="user" class="bg-gray-100" />
    </div>
    <div>
      <div class="mb-1">New owner</div>
      <div class="rounded border-1">
        <UserItem
          v-if="selectedUser && !userSelectMenu"
          :user="selectedUser"
          class="cursor-pointer"
          @click="userSelectMenu = true"
        >
          <template #append>
            <GeneralIcon icon="arrowDown" class="text-gray-500" />
          </template>
        </UserItem>

        <div v-else class="flex flex-row items-center gap-x-2 h-12.5 p-2" style="border-bottom: 1px solid; border-color: inherit">
          <GeneralIcon icon="search" class="text-gray-500 ml-2" />
          <input :ref="inputEl" v-model="searchQuery" class="border-0 px-2.5 outline-none" />
        </div>

        <div v-if="!selectedUser || userSelectMenu" class="max-h-65 overflow-auto">
          <UserItem
            v-for="user of filterdBaseUsers"
            style="border-bottom: 1px solid; border-color: inherit"
            class="cursor-pointer hover:(bg-gray-100)"
            :class="{ 'bg-gray-100': selectedUser === user }"
            :user="user"
            @click="selectUser(user)"
          >
          </UserItem>
        </div>

        <div v-if="!filterdBaseUsers?.length" class="h-12.5 p-2 text-gray-400 text-sm flex items-center justify-center">
          No base users found
        </div>
      </div>
    </div>

    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton size="small" type="secondary" @click="vModel = false"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
          size="small"
          type="primary"
          class="nc-invite-btn"
          :disabled="!selectedUser"
          :loading="isLoading"
          @click="assignView"
        >
          {{ $t('activity.assignView') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
