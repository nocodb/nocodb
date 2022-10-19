<script lang="ts" setup>
import { Role, useNuxtApp } from '#imports'

const { $api } = useNuxtApp()

const { list: users, pageInfo } = await $api.orgUsers.orgUsersList()
</script>

<template>
  <div class="max-w-[700px] mx-auto p-4">
    <div class="px-5">
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
<!--          <div v-if="user.roles" class="rounded-full px-2 py-1 nc-user-role">
            {{ $t(`objects.roleType.${user.roles.split(',')[0].replace(/-(\w)/g, (_, m1) => m1.toUpperCase())}`) }}
          </div>-->

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
    </div>
  </div>
</template>

<style scoped></style>
