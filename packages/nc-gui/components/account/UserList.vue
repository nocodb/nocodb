<script lang="ts" setup>
import { OrgUserRoles } from 'nocodb-sdk'
import type { OrgUserReqType, RequestParams, UserType } from 'nocodb-sdk'
import type { User } from '#imports'
import { extractSdkResponseErrorMsg, iconMap, useApi, useCopy, useDashboard, useDebounceFn, useNuxtApp } from '#imports'

const { api, isLoading } = useApi()

// for loading screen
isLoading.value = true

const { $e } = useNuxtApp()

const { t } = useI18n()

const { dashboardUrl } = useDashboard()

const { user: loggedInUser } = useGlobal()

const { copy } = useCopy()

const users = ref<UserType[]>([])

const currentPage = ref(1)

const currentLimit = ref(10)

const showUserModal = ref(false)

const userMadalKey = ref(0)

const isOpen = ref(false)

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
  position: ['bottomCenter'],
})

const loadUsers = useDebounceFn(async (page = currentPage.value, limit = currentLimit.value) => {
  currentPage.value = page
  try {
    const response: any = await api.orgUsers.list({
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
        query: searchText.value,
      },
    } as RequestParams)

    if (!response) return

    pagination.total = response.pageInfo.totalRows ?? 0

    pagination.pageSize = 10

    users.value = response.list as UserType[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}, 500)

onMounted(() => {
  loadUsers()
})

const updateRole = async (userId: string, roles: string) => {
  try {
    await api.orgUsers.update(userId, {
      roles,
    } as OrgUserReqType)
    message.success(t('msg.success.roleUpdated'))

    $e('a:org-user:role-updated', { role: roles })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const deleteModalInfo = ref<UserType | null>(null)

const deleteUser = async () => {
  try {
    await api.orgUsers.delete(deleteModalInfo.value?.id as string)
    message.success(t('msg.success.userDeleted'))

    await loadUsers()

    if (!users.value.length && currentPage.value !== 1) {
      currentPage.value--
      loadUsers(currentPage.value)
    }
    $e('a:org-user:user-deleted')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    // closing the modal
    isOpen.value = false
    deleteModalInfo.value = null
  }
}

const resendInvite = async (user: UserType) => {
  try {
    await api.orgUsers.resendInvite(user.id)

    // Invite email sent successfully
    message.success(t('msg.success.inviteEmailSent'))
    await loadUsers()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:org-user:resend-invite')
}

const copyInviteUrl = async (user: User) => {
  if (!user.invite_token) return
  try {
    await copy(`${dashboardUrl.value}#/signup/${user.invite_token}`)

    // Invite URL copied to clipboard
    message.success(t('msg.success.inviteURLCopied'))
  } catch (e: any) {
    message.error(e.message)
  }
  $e('c:user:copy-url')
}

const copyPasswordResetUrl = async (user: UserType) => {
  try {
    const { reset_password_url } = await api.orgUsers.generatePasswordResetToken(user.id)

    await copy(reset_password_url!)

    // Invite URL copied to clipboard
    message.success(t('msg.success.passwordResetURLCopied'))
    $e('c:user:copy-url')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const openInviteModal = () => {
  showUserModal.value = true
  userMadalKey.value++
}

const openDeleteModal = (user: UserType) => {
  deleteModalInfo.value = user
  isOpen.value = true
}
</script>

<template>
  <div data-testid="nc-super-user-list" class="h-full">
    <div class="max-w-195 mx-auto h-full">
      <div class="text-2xl text-left font-weight-bold mb-4" data-rec="true">{{ $t('title.userMgmt') }}</div>
      <div class="py-2 flex gap-4 items-center justify-between">
        <a-input v-model:value="searchText" class="!max-w-90 !rounded-md" placeholder="Search members" @change="loadUsers()">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>
        <div class="flex gap-3 items-center justify-center">
          <component :is="iconMap.reload" class="cursor-pointer" @click="loadUsers(currentPage, currentLimit)" />
          <NcButton data-testid="nc-super-user-invite" size="small" type="primary" @click="openInviteModal">
            <div class="flex items-center gap-1" data-rec="true">
              <component :is="iconMap.plus" />
              {{ $t('activity.inviteUser') }}
            </div>
          </NcButton>
        </div>
      </div>
      <div class="w-full rounded-md max-w-250 h-[calc(100%-12rem)] rounded-md overflow-hidden mt-5">
        <div class="flex w-full bg-gray-50 border-1 rounded-t-md">
          <div class="py-3.5 text-gray-500 font-medium text-3.5 w-2/3 text-start pl-6" data-rec="true">
            {{ $t('labels.email') }}
          </div>
          <div class="py-3.5 text-gray-500 font-medium text-3.5 w-1/3 text-start" data-rec="true">{{ $t('objects.role') }}</div>
          <div class="flex py-3.5 text-gray-500 font-medium text-3.5 w-28 justify-end mr-4" data-rec="true">
            {{ $t('labels.action') }}
          </div>
        </div>
        <div v-if="isLoading" class="flex items-center justify-center text-center h-[513px]">
          <GeneralLoader size="xlarge" />
        </div>
        <!-- if users are empty -->
        <div v-else-if="!users.length" class="flex items-center justify-center text-center h-full">
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </div>
        <section v-else class="tbody h-[calc(100%-4rem)] nc-scrollbar-md border-t-0 !overflow-auto">
          <div
            v-for="el of users"
            :key="el.id"
            data-testid="nc-token-list"
            class="user flex py-3 justify-around px-1 border-b-1 border-l-1 border-r-1"
            :class="{
              'py-4': el.roles?.includes('super'),
            }"
          >
            <div class="text-3.5 text-start w-2/3 pl-5 flex items-center">
              <GeneralTruncateText length="29">
                {{ el.email }}
              </GeneralTruncateText>
            </div>
            <div class="text-3.5 text-start w-1/3">
              <div v-if="el?.roles?.includes('super')" class="font-weight-bold" data-rec="true">
                {{ $t('labels.superAdmin') }}
              </div>
              <NcSelect
                v-else
                v-model:value="el.roles"
                class="w-55 nc-user-roles"
                :dropdown-match-select-width="false"
                @change="updateRole(el.id, el.roles as string)"
              >
                <a-select-option
                  class="nc-users-list-role-option"
                  :value="OrgUserRoles.CREATOR"
                  :label="$t(`objects.roleType.orgLevelCreator`)"
                >
                  <div data-rec="true">{{ $t(`objects.roleType.orgLevelCreator`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal" data-rec="true">
                    {{ $t('msg.info.roles.orgCreator') }}
                  </span>
                </a-select-option>

                <a-select-option
                  class="nc-users-list-role-option"
                  :value="OrgUserRoles.VIEWER"
                  :label="$t(`objects.roleType.orgLevelViewer`)"
                >
                  <div data-rec="true">{{ $t(`objects.roleType.orgLevelViewer`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal" data-rec="true">
                    {{ $t('msg.info.roles.orgViewer') }}
                  </span>
                </a-select-option>
              </NcSelect>
            </div>
            <span class="w-26 flex items-center justify-end mr-4">
              <div
                class="flex items-center gap-2"
                :class="{
                  'opacity-0': el.roles?.includes('super'),
                }"
              >
                <NcDropdown :trigger="['click']">
                  <NcButton size="xsmall" type="ghost">
                    <MdiDotsVertical
                      class="text-gray-600 h-5.5 w-5.5 rounded outline-0 p-0.5 nc-workspace-menu transform transition-transform !text-gray-400 cursor-pointer hover:(!text-gray-500 bg-gray-100)"
                    />
                  </NcButton>

                  <template #overlay>
                    <NcMenu>
                      <template v-if="!el.roles?.includes('super')">
                        <!-- Resend invite Email -->
                        <NcMenuItem @click="resendInvite(el)">
                          <component :is="iconMap.email" class="flex text-gray-600" />
                          <div data-rec="true">{{ $t('activity.resendInvite') }}</div>
                        </NcMenuItem>
                        <NcMenuItem @click="copyInviteUrl(el)">
                          <component :is="iconMap.copy" class="flex text-gray-600" />
                          <div data-rec="true">{{ $t('activity.copyInviteURL') }}</div>
                        </NcMenuItem>
                        <NcMenuItem @click="copyPasswordResetUrl(el)">
                          <component :is="iconMap.copy" class="flex text-gray-600" />
                          <div>{{ $t('activity.copyPasswordResetURL') }}</div>
                        </NcMenuItem>
                      </template>
                      <template v-if="el.id !== loggedInUser?.id">
                        <NcDivider v-if="!el.roles?.includes('super')" />
                        <NcMenuItem data-rec="true" class="!text-red-500 !hover:bg-red-50" @click="openDeleteModal(el)">
                          <MaterialSymbolsDeleteOutlineRounded />
                          {{ $t('general.remove') }} {{ $t('objects.user') }}
                        </NcMenuItem>
                      </template>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </span>
          </div>
        </section>
      </div>
      <div v-if="pagination.total > 10" class="flex items-center justify-center mt-4">
        <a-pagination
          v-model:current="currentPage"
          :total="pagination.total"
          show-less-items
          @change="loadUsers(currentPage, currentLimit)"
        />
      </div>
      <GeneralDeleteModal v-model:visible="isOpen" entity-name="User" :on-delete="() => deleteUser()">
        <template #entity-preview>
          <span>
            <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
              <GeneralIcon icon="account" class="nc-view-icon"></GeneralIcon>
              <div
                class="text-ellipsis overflow-hidden select-none w-full pl-1.75"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ deleteModalInfo?.email }}
              </div>
            </div>
          </span>
        </template>
      </GeneralDeleteModal>

      <LazyAccountUsersModal :key="userMadalKey" :show="showUserModal" @closed="showUserModal = false" @reload="loadUsers" />
    </div>
  </div>
</template>

<style scoped>
.user:last-child {
  @apply rounded-b-md;
}
</style>
