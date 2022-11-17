<script lang="ts" setup>
import { Modal, message } from 'ant-design-vue'
import type { RequestParams, UserType } from 'nocodb-sdk'
import { Role, extractSdkResponseErrorMsg, useApi, useCopy, useDashboard, useNuxtApp } from '#imports'
import type { User } from '~/lib'

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { dashboardUrl } = $(useDashboard())

const { copy } = useCopy()

let users = $ref<UserType[]>([])

let currentPage = $ref(1)

const currentLimit = $ref(10)

const showUserModal = ref(false)

const userMadalKey = ref(0)

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})
const loadUsers = async (page = currentPage, limit = currentLimit) => {
  currentPage = page
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

    users = response.list as UserType[]
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadUsers()

const updateRole = async (userId: string, roles: Role) => {
  try {
    await api.orgUsers.update(userId, {
      roles,
    } as unknown as UserType)
    message.success(t('msg.success.roleUpdated'))

    $e('a:org-user:role-updated', { role: roles })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
const deleteUser = async (userId: string) => {
  Modal.confirm({
    title: 'Are you sure you want to delete this user?',
    type: 'warn',
    content: 'On deleting, user will remove from organization and any sync source(Airtable) created by user will get removed',
    onOk: async () => {
      try {
        await api.orgUsers.delete(userId)
        message.success(t('msg.success.userDeleted'))
        await loadUsers()
        $e('a:org-user:user-deleted')
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const resendInvite = async (user: User) => {
  try {
    await api.orgUsers.resendInvite(user.id)

    // Invite email sent successfully
    message.success(t('msg.success.inviteEmailSent'))
    await loadUsers()
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:org-user:resend-invite')
}

const copyInviteUrl = (user: User) => {
  if (!user.invite_token) return

  copy(`${dashboardUrl}#/signup/${user.invite_token}`)

  // Invite URL copied to clipboard
  message.success(t('msg.success.inviteURLCopied'))
  $e('c:user:copy-url')
}

const copyPasswordResetUrl = async (user: User) => {
  try {
    const { reset_password_url } = await api.orgUsers.generatePasswordResetToken(user.id)

    copy(reset_password_url)

    // Invite URL copied to clipboard
    message.success(t('msg.success.passwordResetURLCopied'))
    $e('c:user:copy-url')
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div data-testid="nc-super-user-list">
    <div class="text-xl mt-4 mb-8 text-center font-weight-bold">User Management</div>
    <div class="max-w-[900px] mx-auto p-4">
      <div class="py-2 flex gap-4 items-center">
        <a-input-search
          v-model:value="searchText"
          size="small"
          class="max-w-[300px]"
          placeholder="Filter by email"
          @blur="loadUsers"
          @keydown.enter="loadUsers"
        >
        </a-input-search>
        <div class="flex-grow"></div>
        <MdiReload class="cursor-pointer" @click="loadUsers" />
        <a-button
          data-testid="nc-super-user-invite"
          size="small"
          type="primary"
          @click="
            () => {
              showUserModal = true
              userMadalKey++
            }
          "
        >
          <div class="flex items-center gap-1">
            <MdiAdd />
            Invite new user
          </div>
        </a-button>
      </div>
      <a-table
        :row-key="(record) => record.id"
        :data-source="users"
        :pagination="{ position: ['bottomCenter'] }"
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
              <div v-if="record.roles.includes('super')" class="font-weight-bold">Super Admin</div>
              <a-select
                v-else
                v-model:value="record.roles"
                class="w-[220px] nc-user-roles"
                :dropdown-match-select-width="false"
                @change="updateRole(record.id, record.roles)"
              >
                <a-select-option
                  class="nc-users-list-role-option"
                  :value="Role.OrgLevelCreator"
                  :label="$t(`objects.roleType.orgLevelCreator`)"
                >
                  <div>{{ $t(`objects.roleType.orgLevelCreator`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal">
                    {{ $t('msg.info.roles.orgCreator') }}
                  </span>
                </a-select-option>

                <a-select-option
                  class="nc-users-list-role-option"
                  :value="Role.OrgLevelViewer"
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
                      <MdiDotsHorizontal class="nc-user-row-action" />
                    </div>
                  </a-button>
                </div>

                <template #overlay>
                  <a-menu>
                    <template v-if="record.invite_token">
                      <a-menu-item>
                        <!-- Resend invite Email -->
                        <div class="flex flex-row items-center py-3" @click="resendInvite(record)">
                          <MdiEmailArrowRightOutline class="flex h-[1rem] text-gray-500" />
                          <div class="text-xs pl-2">{{ $t('activity.resendInvite') }}</div>
                        </div>
                      </a-menu-item>
                      <a-menu-item>
                        <div class="flex flex-row items-center py-3" @click="copyInviteUrl(record)">
                          <MdiContentCopy class="flex h-[1rem] text-gray-500" />
                          <div class="text-xs pl-2">{{ $t('activity.copyInviteURL') }}</div>
                        </div>
                      </a-menu-item>
                    </template>
                    <a-menu-item>
                      <div class="flex flex-row items-center py-3" @click="copyPasswordResetUrl(record)">
                        <MdiContentCopy class="flex h-[1rem] text-gray-500" />
                        <div class="text-xs pl-2">{{ $t('activity.copyPasswordResetURL') }}</div>
                      </div>
                    </a-menu-item>
                    <a-menu-item>
                      <div class="flex flex-row items-center py-3" @click="deleteUser(text)">
                        <MdiDeleteOutline data-testid="nc-super-user-delete" class="flex h-[1rem] text-gray-500" />
                        <div class="text-xs pl-2">{{ $t('general.delete') }}</div>
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
            <span v-else></span>
          </template>
        </a-table-column>
      </a-table>

      <LazyAccountUsersModal :key="userMadalKey" :show="showUserModal" @closed="showUserModal = false" @reload="loadUsers" />
    </div>
  </div>
</template>
