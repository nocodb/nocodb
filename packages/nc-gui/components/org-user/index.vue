<script lang="ts" setup>
import { Modal, message } from 'ant-design-vue'
import type { RequestParams, UserType } from 'nocodb-sdk'
import { Role, extractSdkResponseErrorMsg } from '#imports'
import { useApi } from '~/composables/useApi'

const { api, isLoading } = useApi()

let users = $ref<UserType[]>([])

let currentPage = $ref(1)

const currentLimit = $ref(10)

const showUserModal = ref(false)

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
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadUsers()

const updateRole = async (userId: string, roles: Role) => {
  try {
    await api.orgUsers.update(userId, {
      roles,
    } as unknown as UserType)
    message.success('Role updated successfully')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
const deleteUser = async (userId: string) => {
  Modal.confirm({
    title: 'Are you sure you want to delete this user?',
    type: 'warn',
    content:
      'On deleting, user will remove from from organization and any sync source(Airtable) created by user will get removed',
    onOk: async () => {
      try {
        await api.orgUsers.delete(userId)
        message.success('User deleted successfully')
        await loadUsers()
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}
</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull">
    <div class="max-w-[700px] mx-auto p-4">
      <div class="py-2 flex">
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
        <a-button size="small" @click="showUserModal = true">
          <div class="flex items-center gap-1">
            <MdiAdd />
            Invite new user
          </div>
        </a-button>
      </div>
      <a-table
        :row-key="(record) => record.id"
        :data-source="users"
        :pagination="pagination"
        :loading="isLoading"
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
                class="w-[220px]"
                :dropdown-match-select-width="false"
                @change="updateRole(record.id, record.roles)"
              >
                <a-select-option :value="Role.OrgLevelCreator" :label="$t(`objects.roleType.orgLevelCreator`)">
                  <div >{{ $t(`objects.roleType.orgLevelCreator`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal"
                    >Creator can create new projects and access any invited project.</span
                  >
                </a-select-option>

                <a-select-option :value="Role.OrgLevelViewer" :label="$t(`objects.roleType.orgLevelViewer`)">
                  <div >{{ $t(`objects.roleType.orgLevelViewer`) }}</div>
                  <span class="text-gray-500 text-xs whitespace-normal"
                    >Viewer is not allowed to create new projects but they can access any invited project.</span
                  >
                </a-select-option>
              </a-select>
            </div>
          </template>
        </a-table-column>

        <!-- Projects -->
        <a-table-column key="projectsCount" :title="$t('objects.projects')" data-index="projectsCount">
          <template #default="{ text }">
            <div>
              {{ text }}
            </div>
          </template>
        </a-table-column>

        <!-- Actions -->

        <a-table-column key="id" :title="$t('labels.actions')" data-index="id">
          <template #default="{ text }">
            <div class="flex items-center gap-2">
              <MdiDeleteOutline class="nc-action-btn cursor-pointer" @click="deleteUser(text)" />
            </div>
          </template>
        </a-table-column>
      </a-table>

      <LazyOrgUserUsersModal :show="showUserModal" @closed="showUserModal = false" @reload="loadUsers" />
    </div>
  </div>
</template>

<style scoped></style>
