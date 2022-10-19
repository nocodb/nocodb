<script lang="ts" setup>
import { message, Modal } from 'ant-design-vue'
import type { RequestParams } from 'nocodb-sdk'
import type { User } from '#imports'
import { Role, extractSdkResponseErrorMsg, useNuxtApp } from '#imports'
import { useApi } from '~/composables/useApi'

const { api, isLoading } = useApi()

let users = $ref<null | User[]>(null)

let totalRows = $ref(0)

const currentPage = $ref(1)

const currentLimit = $ref(10)

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})
const loadUsers = async (page = currentPage, limit = currentLimit) => {
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

    users = response.list as User[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}


loadUsers()

const updateRole = async (userId: string, roles: Role) => {
  try {
    await api.orgUsers.update(userId, {
      roles,
    } as unknown as User)
    message.success('Role updated successfully')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
const deleteUser = async (userId: string) => {
  Modal.confirm({
    title: 'Are you sure you want to delete this user?',
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
  <div class=" h-full overflow-y-scroll scrollbar-thin-dull">
    <div class="max-w-[700px] mx-auto p-4">
      <a-input-search size="small" class="my-4 max-w-[300px]" placeholder="Filter by email" v-model:value="searchText"
                      @change="loadUsers" @keydown.enter="loadUsers"></a-input-search>
      <a-table
        :row-key="(record) => record.id"
        :data-source="users"
        :pagination="pagination"
        :loading="isLoading"
        @change="loadUsers"
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
              <a-select
                v-model:value="record.roles"
                class="min-w-[220px]"
                :options="[
                { value: Role.OrgLevelCreator, label: $t(`objects.roleType.orgLevelCreator`) },
                { value: Role.OrgLevelViewer, label: $t(`objects.roleType.orgLevelViewer`) },
              ]"
                @change="updateRole(record.id, record.roles)"
              >
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

      <!--    <div class="py-4"> -->
      <!--      <a-input-search class="mx-w-[300px]" v-model="searchText" @search="loadUsers" /> -->
      <!--    </div> -->

      <!--    <div class="px-5">
            <div class="flex flex-row border-b-1 pb-2 px-2">
              <div class="flex flex-row w-4/6 space-x-1 items-center pl-1">
                <EvaEmailOutline class="flex text-gray-500 -mt-0.5" />

                <div class="text-gray-600 text-xs space-x-1">{{ $t('labels.email') }}</div>
              </div>
              <div class="flex flex-row w-4/6 space-x-1 items-center pl-1">
                <EvaEmailOutline class="flex text-gray-500 -mt-0.5" />

                <div class="text-gray-600 text-xs space-x-1">{{ $t('object.projects') }}</div>
              </div>
              <div class="flex flex-row justify-center w-1/6 space-x-1 items-center pl-1">
                <MdiDramaMasks class="flex text-gray-500 -mt-0.5" />

                <div class="text-gray-600 text-xs">{{ $t('objects.role') }}</div>
              </div>
              <div class="flex flex-row w-1/6 justify-end items-center pl-1">
                <div class="text-gray-600 text-xs">{{ $t('labels.actions') }}</div>
              </div>
            </div>
            <div v-for="(user, index) of users" :key="index" class="flex flex-row items-center border-b-1 py-2 px-2 nc-user-row">
              <div class="flex w-4/6 flex-wrap nc-user-email">
                {{ user.email }}
              </div>

              <div class="flex w-1/6 justify-center flex-wrap ml-4">
                {{ user.projectsCount }}
                </div>
              <div class="flex w-1/6 justify-center flex-wrap ml-4">
      &lt;!&ndash;          <div v-if="user.roles" class="rounded-full px-2 py-1 nc-user-role">
                  {{ $t(`objects.roleType.${user.roles.split(',')[0].replace(/-(\w)/g, (_, m1) => m1.toUpperCase())}`) }}
                </div>&ndash;&gt;

                <a-select
                  class="min-w-[220px]"
                  :options="[
                    { value: Role.OrgLevelCreator, label: $t(`objects.roleType.orgLevelCreator`) },
                    { value: Role.OrgLevelViewer, label: $t(`objects.roleType.orgLevelViewer`) },
                  ]"
                >
                </a-select>
              </div>
              <div class="flex w-1/6 flex-wrap justify-end">
                <MdiDeleteOutline />
              </div>
            </div>

            <a-pagination
              v-model:current="currentPage"
              hide-on-single-page
              class="mt-4"
              :page-size="currentLimit"
              :total="totalRows"
              show-less-items
              @change="loadUsers"
            />
          </div> -->
    </div>
  </div>
</template>

<style scoped></style>
