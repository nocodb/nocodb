<script lang="ts" setup>
import { OrgUserRoles } from 'nocodb-sdk'
import type { OrgUserReqType, RequestParams, Roles, UserType } from 'nocodb-sdk'
import type { User } from '#imports'
import { extractSdkResponseErrorMsg, iconMap, useApi, useCopy, useDashboard, useNuxtApp } from '#imports'

const { api, isLoading } = useApi()

// for loading screen
isLoading.value = true

const { $e } = useNuxtApp()

const { t } = useI18n()

const { dashboardUrl } = useDashboard()

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

loadUsers()

const updateRole = async (userId: string, roles: Roles) => {
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

const deleteUser = async (userId: string) => {
  try {
    await api.orgUsers.delete(userId)
    message.success(t('msg.success.userDeleted'))

    await loadUsers()

    if (!users.value.length && currentPage.value !== 1) {
      currentPage.value--
      loadUsers(currentPage.value)
    }
    $e('a:org-user:user-deleted')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  // closing the modal
  isOpen.value = false
}

const resendInvite = async (user: User) => {
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

const copyPasswordResetUrl = async (user: User) => {
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
</script>

<template>
  <div data-testid="nc-super-user-list">
<<<<<<< HEAD
    <div class="max-w-[900px] mx-auto">
      <div class="text-xl my-4 text-left font-weight-bold">{{ $t('title.userManagement') }}</div>
      <div class="py-2 flex gap-4 items-center">
        <a-input-search
          v-model:value="searchText"
          size="middle"
          class="max-w-[300px]"
          :placeholder="$t('labels.searchUsers')"
          @blur="loadUsers"
          @keydown.enter="loadUsers"
        >
        </a-input-search>
        <div class="flex-grow"></div>
        <component :is="iconMap.reload" class="cursor-pointer" @click="loadUsers" />
        <a-button
          data-testid="nc-super-user-invite"
          size="middle"
          class="!rounded-md"
          type="primary"
          @click="
            () => {
              showUserModal = true
              userMadalKey++
            }
          "
        >
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" />
            {{ $t('activity.inviteUser') }}
          </div>
        </a-button>
      </div>
      <a-table
        :row-key="(record) => record.id"
        :data-source="users"
        :pagination="pagination"
        :loading="isLoading"
        size="small"
        @change="loadUsers($event.current)"
      >
        <template #emptyText>
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </template>

        <!-- Email -->
        <a-table-column key="email" :title="$t('labels.email')" data-index="email">
          <template #default="{ text }">
            <div>
              {{ text }}
            </div>
          </template>
        </a-table-column>

        <!-- Role -->
        <a-table-column key="roles" :title="$t('objects.role')" data-index="roles">
          <template #default="{ record }">
            <div>
              <div v-if="record.roles.includes('super')" class="font-weight-bold">{{ $t('labels.superAdmin') }}</div>
              <a-select
                v-else
                v-model:value="record.roles"
                class="w-[220px] nc-user-roles"
                :dropdown-match-select-width="false"
                @change="updateRole(record.id, record.roles)"
              >
                <a-select-option
                  class="nc-users-list-role-option"
                  :value="OrgUserRoles.CREATOR"
                  :label="$t(`objects.roleType.orgLevelCreator`)"
                >
                  <div>{{ $t(`objects.roleType.orgLevelCreator`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal">
                    {{ $t('msg.info.roles.orgCreator') }}
                  </span>
                </a-select-option>

                <a-select-option
                  class="nc-users-list-role-option"
                  :value="OrgUserRoles.VIEWER"
                  :label="$t(`objects.roleType.orgLevelViewer`)"
                >
                  <div>{{ $t(`objects.roleType.orgLevelViewer`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal">
                    {{ $t('msg.info.roles.orgViewer') }}
                  </span>
                </a-select-option>
              </a-select>
            </div>
          </template>
        </a-table-column>

        <!--        &lt;!&ndash; Projects &ndash;&gt;
        <a-table-column key="projectsCount" :title="$t('objects.projects')" data-index="projectsCount">
          <template #default="{ text }">
            <div>
              {{ text }}
            </div>
          </template>
        </a-table-column> -->

        <!-- Actions -->

        <a-table-column key="id" :title="$t('labels.actions')" data-index="id">
          <template #default="{ text, record }">
            <div v-if="!record.roles.includes('super')" class="flex items-center gap-2">
              <a-dropdown :trigger="['click']" class="flex" placement="bottomRight" overlay-class-name="nc-dropdown-user-mgmt">
                <div class="flex flex-row items-center">
                  <a-button type="text" class="!px-0">
                    <div class="flex flex-row items-center h-[1.2rem]">
                      <component :is="iconMap.threeDotHorizontal" class="nc-user-row-action" />
                    </div>
                  </a-button>
                </div>

                <template #overlay>
                  <a-menu>
                    <template v-if="record.invite_token">
                      <a-menu-item>
                        <!-- Resend invite Email -->
                        <div class="flex flex-row items-center py-3" @click="resendInvite(record)">
                          <component :is="iconMap.email" class="flex h-[1rem] text-gray-500" />
                          <div class="text-xs pl-2">{{ $t('activity.resendInvite') }}</div>
                        </div>
                      </a-menu-item>
                      <a-menu-item>
                        <div class="flex flex-row items-center py-3" @click="copyInviteUrl(record)">
                          <component :is="iconMap.copy" class="flex h-[1rem] text-gray-500" />
                          <div class="text-xs pl-2">{{ $t('activity.copyInviteURL') }}</div>
                        </div>
                      </a-menu-item>
                    </template>
                    <a-menu-item>
                      <div class="flex flex-row items-center py-3" @click="copyPasswordResetUrl(record)">
                        <component :is="iconMap.copy" class="flex h-[1rem] text-gray-500" />
                        <div class="text-xs pl-2">{{ $t('activity.copyPasswordResetURL') }}</div>
                      </div>
                    </a-menu-item>
                    <a-menu-item>
                      <div class="flex flex-row items-center py-3" @click="isOpen = true">
                        <!-- Delete user modal -->
                        <GeneralDeleteModal v-model:visible="isOpen" entity-name="User" :on-delete="() => deleteUser(text)">
                          <template #entity-preview>
                            <span>
                              <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
                                <GeneralIcon icon="account" class="nc-view-icon"></GeneralIcon>
                                <div
                                  class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
                                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                                >
                                  {{ record.email }}
                                </div>
                              </div>
                            </span>
                          </template>
                        </GeneralDeleteModal>
                        <component :is="iconMap.delete" data-testid="nc-super-user-delete" class="flex h-[1rem] text-gray-500" />
                        <div class="text-xs pl-2">{{ $t('general.delete') }}</div>
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
<<<<<<< HEAD
            <span v-else></span>
          </template>
        </a-table-column>
      </a-table>
=======
          </span>
        </div>
=======
    <div class="max-w-195 mx-auto">
      <div class="text-xl my-4 text-left font-weight-bold">User Management</div>
      <div class="py-2 flex gap-4 items-center justify-between">
        <a-input v-model:value="searchText" class="!max-w-90 !rounded-md" placeholder="Search members" @change="loadUsers()">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>
        <div class="flex gap-3 items-center justify-center">
          <component :is="iconMap.reload" class="cursor-pointer" @click="loadUsers(currentPage, currentLimit)" />
          <NcButton data-testid="nc-super-user-invite" size="small" type="primary" @click="openInviteModal">
            <div class="flex items-center gap-1">
              <component :is="iconMap.plus" />
              Invite new user
            </div>
          </NcButton>
        </div>
      </div>
      <div class="w-[780px] mt-5 border-1 rounded-md h-[613px]">
        <div class="flex w-full bg-gray-50 border-b-1">
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-1/3 text-start pl-10">{{ $t('labels.email') }}</span>
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-1/3 text-start pl-20">{{ $t('objects.role') }}</span>
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-1/3 text-end pl-42">Actions</span>
        </div>
        <div v-if="isLoading" class="flex items-center justify-center text-center h-[513px]">
          <GeneralLoader size="xlarge" />
        </div>
        <!-- if users are empty -->
        <div v-else-if="!users.length" class="flex items-center justify-center text-center h-[513px]">
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </div>
        <section v-else class="tbody">
          <div
            v-for="el of users"
            :key="el.id"
            data-testid="nc-token-list"
            class="flex py-3 justify-around px-5 border-b-1"
            :class="{
              'py-4': el.roles?.includes('super'),
            }"
          >
            <span class="text-3.5 text-start w-1/3 pl-5">
              {{ el.email }}
            </span>
            <span class="text-3.5 text-start w-1/3 pl-18">
              <div v-if="el?.roles?.includes('super')" class="font-weight-bold">Super Admin</div>
              <a-select
                v-else
                v-model:value="el.roles"
                class="w-[220px] nc-user-roles"
                :dropdown-match-select-width="false"
                @change="updateRole(el.id, el.roles as string)"
              >
                <a-select-option
                  class="nc-users-list-role-option"
                  :value="OrgUserRoles.CREATOR"
                  :label="$t(`objects.roleType.orgLevelCreator`)"
                >
                  <div>{{ $t(`objects.roleType.orgLevelCreator`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal">
                    {{ $t('msg.info.roles.orgCreator') }}
                  </span>
                </a-select-option>

                <a-select-option
                  class="nc-users-list-role-option"
                  :value="OrgUserRoles.VIEWER"
                  :label="$t(`objects.roleType.orgLevelViewer`)"
                >
                  <div>{{ $t(`objects.roleType.orgLevelViewer`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal">
                    {{ $t('msg.info.roles.orgViewer') }}
                  </span>
                </a-select-option>
              </a-select>
            </span>
            <span class="w-1/3 pl-43">
              <div
                class="flex items-center gap-2"
                :class="{
                  'opacity-0': el.roles?.includes('super'),
                }"
              >
                <NcDropdown :trigger="['click']">
                  <MdiDotsVertical
                    class="border-1 !text-gray-600 h-5.5 w-5.5 rounded outline-0 p-0.5 nc-workspace-menu transform transition-transform !text-gray-400 cursor-pointer hover:(!text-gray-500 bg-gray-100)"
                  />
                  <template #overlay>
                    <NcMenu>
                      <template v-if="!el.roles?.includes('super')">
                        <!-- Resend invite Email -->
                        <NcMenuItem @click="resendInvite(el)">
                          <component :is="iconMap.email" class="flex text-gray-500" />
                          <div>{{ $t('activity.resendInvite') }}</div>
                        </NcMenuItem>
                        <NcMenuItem @click="copyInviteUrl(el)">
                          <component :is="iconMap.copy" class="flex text-gray-500" />
                          <div>{{ $t('activity.copyInviteURL') }}</div>
                        </NcMenuItem>
                        <NcMenuItem @click="copyPasswordResetUrl(el)">
                          <component :is="iconMap.copy" class="flex text-gray-500" />
                          <div>{{ $t('activity.copyPasswordResetURL') }}</div>
                        </NcMenuItem>
                      </template>
                      <NcDivider v-if="!el.roles?.includes('super')" />
                      <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="openDeleteModal(el)">
                        <MaterialSymbolsDeleteOutlineRounded />
                        Remove user
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </span>
          </div>
        </section>
>>>>>>> 994c6208a (feat: moved reset password to client side)
      </div>
      <div v-if="pagination.total > 10" class="flex items-center justify-center mt-7">
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
                class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ deleteModalInfo?.email }}
              </div>
            </div>
          </span>
        </template>
      </GeneralDeleteModal>
>>>>>>> 85fee1233 (feat: pagination)

      <LazyAccountUsersModal :key="userMadalKey" :show="showUserModal" @closed="showUserModal = false" @reload="loadUsers" />
    </div>
  </div>
</template>

<style scoped>
.tbody div:nth-child(10) {
  border-bottom: none;
}
</style>
